import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { redis, rateLimit } from '@/server/redis';
import { AppError, assert, errorResponse } from '@/server/errors';
import {
  sessionUser,
  requireUser,
  authorize,
  checkOrigin,
  passwordHash,
  passwordMatches,
  createSession,
  hash,
  verifySignature,
  encryptPii,
} from '@/server/security';
import { credentialsSchema, passengerSchema, tourSchema } from '@/server/validation';
import { catalog, searchOffers, dateOnly } from '@/server/services/catalog';
import {
  createReservation,
  orderInclude,
  cancelOrder,
  audit,
} from '@/server/services/reservations';
import { beginPayment, simulatePayment, processCallback } from '@/server/services/payments';
import { fulfilReservation } from '@/server/services/fulfilment';
import { serializable } from '@/server/transaction';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
async function body(req: Request) {
  const raw = await req.text();
  assert(Buffer.byteLength(raw) <= 32000, 413, 'TOO_LARGE', 'اندازه درخواست بیش از حد مجاز است.');
  return JSON.parse(raw);
}
async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const requestId = randomUUID();
  try {
    const { path } = await context.params;
    const route = path.join('/'),
      method = request.method,
      url = new URL(request.url);
    if (route === 'payments/callback' && method === 'POST') {
      const raw = await request.text();
      assert(
        raw.length <= 10000 &&
          verifySignature(raw, request.headers.get('x-payment-signature') ?? ''),
        403,
        'SIGNATURE',
        'امضای رویداد معتبر نیست.'
      );
      const input = z
        .object({ providerReference: z.string().max(100), eventId: z.string().min(8).max(120) })
        .parse(JSON.parse(raw));
      return json(await processCallback(input));
    }
    if (method !== 'GET') checkOrigin(request);
    if (route === 'health' && method === 'GET') {
      await db.$queryRaw`SELECT 1`;
      await redis.ping();
      const heartbeat = await db.systemSetting.findUnique({ where: { key: 'worker-heartbeat' } });
      const last = (heartbeat?.value as { at?: string } | null)?.at;
      const worker = last && Date.now() - Date.parse(last) < 15000 ? 'ok' : 'stale';
      return json(
        {
          status: worker === 'ok' ? 'ok' : 'degraded',
          database: 'ok',
          redis: 'ok',
          worker,
          providerMode: 'DEMO',
        },
        worker === 'ok' ? 200 : 503
      );
    }
    if (route === 'catalog' && method === 'GET')
      return json({
        offers: await catalog(),
        articles: await db.article.findMany({ where: { published: true } }),
        mode: 'DEMO',
      });
    if (route === 'search' && method === 'GET')
      return json({
        offers: await searchOffers(Object.fromEntries(url.searchParams)),
        mode: 'DEMO',
        quoteNote: 'قیمت و ظرفیت در مرحله رزرو دوباره بررسی می‌شوند.',
      });
    if (path[0] === 'offers' && path.length === 2 && method === 'GET') {
      const offer = await db.offer.findUnique({
        where: { id: path[1] },
        include: {
          inventory: {
            where: { date: { gte: dateOnly(new Date()) } },
            orderBy: { date: 'asc' },
            take: 60,
          },
        },
      });
      assert(offer?.published, 404, 'NOT_FOUND', 'پیشنهاد یافت نشد.');
      return json(offer);
    }
    if (path[0] === 'articles' && path.length === 2 && method === 'GET') {
      const article = await db.article.findUnique({ where: { id: path[1] } });
      assert(article?.published, 404, 'NOT_FOUND', 'مقاله یافت نشد.');
      return json(article);
    }
    if (route === 'auth/session' && method === 'GET')
      return json({ user: await sessionUser(request) });
    if (['auth/register', 'auth/login'].includes(route) && method === 'POST') {
      const input = credentialsSchema.parse(await body(request));
      await rateLimit('auth-global', 200, 600);
      await rateLimit(`auth:${input.email}`, 10, 600); // Do not trust client-supplied forwarding IP headers.
      let user = await db.user.findUnique({ where: { email: input.email } });
      if (route === 'auth/register') {
        assert(input.name, 422, 'NAME', 'نام خود را وارد کنید.');
        assert(
          !user,
          409,
          'ACCOUNT_EXISTS',
          'حساب موجود است؛ وارد شوید یا با پشتیبانی تماس بگیرید.'
        );
        user = await db.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash: await passwordHash(input.password),
          },
        });
      } else {
        const dummy = '4d395c418a2e15c1718143457a07bbcc:' + '0'.repeat(128);
        const valid = await passwordMatches(input.password, user?.passwordHash ?? dummy);
        assert(user && valid, 401, 'CREDENTIALS', 'ایمیل یا رمز عبور صحیح نیست.');
      }
      return json(
        { user: { id: user.id, name: user.name, email: user.email, role: user.role } },
        200,
        { 'Set-Cookie': await createSession(user.id) }
      );
    }
    const user = await requireUser(request);
    await rateLimit(`user:${user.id}`, 120, 60);
    if (route === 'auth/logout' && method === 'POST') {
      const token = request.headers
        .get('cookie')
        ?.split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('berjis_session='))
        ?.slice(15);
      if (token) await db.session.deleteMany({ where: { id: hash(token) } });
      return json({ ok: true }, 200, {
        'Set-Cookie': 'berjis_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      });
    }
    if (route === 'orders' && method === 'GET')
      return json(
        await db.reservation.findMany({
          where: { userId: user.id },
          include: orderInclude,
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      );
    if (route === 'orders' && method === 'POST')
      return json(
        await createReservation(
          user.id,
          await body(request),
          request.headers.get('idempotency-key') ?? ''
        ),
        201
      );
    if (path[0] === 'orders' && path[1]) {
      const order = await db.reservation.findFirst({
        where: { id: path[1], userId: user.id },
        include: orderInclude,
      });
      assert(order, 404, 'NOT_FOUND', 'سفارش یافت نشد.');
      if (path.length === 2 && method === 'GET') return json(order);
      if (path[2] === 'payments' && method === 'POST')
        return json(await beginPayment(user.id, order.id));
      if (path[2] === 'cancel' && method === 'POST') {
        const { reason } = z
          .object({ reason: z.string().trim().min(5).max(1000) })
          .parse(await body(request));
        return json(await cancelOrder(user.id, order.id, reason));
      }
      if (path[2] === 'receipt' && method === 'GET') {
        assert(
          order.document && order.status === 'CONFIRMED' && order.fulfilmentStatus === 'ISSUED',
          409,
          'NOT_ISSUED',
          'هنوز سند معتبر صادر نشده یا سفارش لغو شده است.'
        );
        const text = [
          'BERJIS — DEMO DOCUMENT / سند آزمایشی؛ فاقد اعتبار سفر',
          `Order: ${order.reference}`,
          `Supplier: ${order.document.supplierReference}`,
          `Product: ${order.product}`,
          `Amount: ${order.totalIrr} IRR`,
          `Payment: ${order.paymentStatus}`,
          `Booking: ${order.status}`,
          `Issued: ${order.document.issuedAt.toISOString()}`,
          ...order.items.map(
            (i) =>
              `${i.offer.title} / ${i.startDate.toISOString().slice(0, 10)} → ${i.endDate.toISOString().slice(0, 10)}`
          ),
          ...order.passengers.map((p) => `${p.firstName} ${p.lastName}`),
        ].join('\n');
        return new Response(text, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${order.reference}-DEMO.txt"`,
            'Cache-Control': 'no-store',
          },
        });
      }
    }
    if (path[0] === 'payments' && path[1]) {
      const payment = await db.payment.findUnique({
        where: { id: path[1] },
        include: {
          reservation: {
            select: {
              userId: true,
              id: true,
              totalIrr: true,
              reference: true,
              paymentStatus: true,
            },
          },
          gateway: { select: { status: true } },
        },
      });
      assert(payment?.reservation.userId === user.id, 404, 'NOT_FOUND', 'تراکنش یافت نشد.');
      if (path.length === 2 && method === 'GET') return json(payment);
      if (path[2] === 'simulate' && method === 'POST') {
        const { outcome } = z
          .object({ outcome: z.enum(['SUCCESS', 'FAILED', 'CANCELLED', 'ISSUE_FAILURE']) })
          .parse(await body(request));
        return json(await simulatePayment(user.id, payment.id, outcome));
      }
    }
    if (route === 'notifications' && method === 'GET')
      return json(
        await db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      );
    if (route === 'notifications/read' && method === 'POST') {
      await db.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return json({ ok: true });
    }
    if (route === 'travelers' && method === 'GET')
      return json(
        await db.traveler.findMany({
          where: { userId: user.id },
          select: { id: true, firstName: true, lastName: true, birthDate: true },
        })
      );
    if (route === 'travelers' && method === 'POST') {
      const { documentNumber, birthDate, ...input } = passengerSchema.parse(await body(request));
      return json(
        await db.traveler.create({
          data: {
            ...input,
            userId: user.id,
            birthDate: dateOnly(birthDate),
            documentCipher: encryptPii(documentNumber),
          },
          select: { id: true, firstName: true, lastName: true, birthDate: true },
        }),
        201
      );
    }
    if (path[0] === 'travelers' && path[1] && method === 'DELETE') {
      await db.traveler.deleteMany({ where: { id: path[1], userId: user.id } });
      return json({ ok: true });
    }
    if (route === 'support' && method === 'GET')
      return json(
        await db.supportTicket.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      );
    if (route === 'support' && method === 'POST') {
      const input = z
        .object({
          subject: z.string().trim().min(5).max(120),
          message: z.string().trim().min(10).max(3000),
        })
        .parse(await body(request));
      return json(await db.supportTicket.create({ data: { ...input, userId: user.id } }), 201);
    }
    if (path[0] === 'admin') {
      if (path[1] === 'overview' && method === 'GET') {
        authorize(user, 'analytics:read');
        const [orders, confirmed, failed, refunds, sales, series] = await Promise.all([
          db.reservation.count(),
          db.reservation.count({ where: { status: 'CONFIRMED' } }),
          db.reservation.count({ where: { status: 'FAILED' } }),
          db.refund.count({ where: { status: { in: ['REQUESTED', 'APPROVED'] } } }),
          db.reservation.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { totalIrr: true } }),
          db.$queryRaw<
            Array<{ day: string; amount: bigint }>
          >`SELECT to_char("createdAt", 'YYYY-MM-DD') as day, SUM("totalIrr")::bigint as amount FROM "Reservation" WHERE "paymentStatus" = 'PAID' GROUP BY day ORDER BY day DESC LIMIT 14`,
        ]);
        return json({
          orders,
          confirmed,
          failed,
          refunds,
          salesIrr: sales._sum.totalIrr ?? 0,
          series: series.map((v) => ({ ...v, amount: Number(v.amount) })),
          mode: 'DEMO',
        });
      }
      if (path[1] === 'orders' && method === 'GET') {
        authorize(user, 'orders:read');
        const q = (url.searchParams.get('q') ?? '').slice(0, 100);
        return json(
          await db.reservation.findMany({
            where: q ? { reference: { contains: q, mode: 'insensitive' } } : {},
            include: orderInclude,
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        );
      }
      if (path[1] === 'orders' && path[2] && path[3] === 'approve' && method === 'POST') {
        authorize(user, 'orders:write');
        await fulfilReservation(path[2], true);
        await db.auditLog.create({
          data: {
            actorId: user.id,
            action: 'MANUAL_CONFIRMATION_REVIEWED',
            reservationId: path[2],
          },
        });
        return json({ ok: true });
      }
      if (path[1] === 'refunds' && method === 'GET') {
        authorize(user, 'refund:write');
        return json(
          await db.refund.findMany({
            include: { reservation: { select: { reference: true, status: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        );
      }
      if (path[1] === 'refunds' && path[2] && method === 'POST') {
        authorize(user, 'refund:write');
        await serializable(async (tx) => {
          const refund = await tx.refund.findUnique({
            where: { id: path[2] },
            include: { reservation: true },
          });
          assert(refund, 404, 'NOT_FOUND', 'درخواست یافت نشد.');
          if (refund.status !== 'REQUESTED') return;
          assert(
            refund.reservation.status === 'CANCELLATION_REQUESTED',
            409,
            'STATE',
            'وضعیت سفارش مناسب استرداد نیست.'
          );
          await tx.refund.update({ where: { id: refund.id }, data: { status: 'APPROVED' } });
          await tx.reservation.update({
            where: { id: refund.reservationId },
            data: { paymentStatus: 'REFUND_PENDING' },
          });
          await tx.durableJob.upsert({
            where: { key: `refund-${refund.reservationId}` },
            create: {
              key: `refund-${refund.reservationId}`,
              kind: 'REFUND',
              reservationId: refund.reservationId,
            },
            update: {},
          });
          await audit(tx, user.id, 'REFUND_APPROVED', refund.reservationId);
        });
        return json({ ok: true });
      }
      if (path[1] === 'tours' && method === 'GET') {
        authorize(user, 'catalog:write');
        return json(
          await db.offer.findMany({
            where: { product: 'TOUR' },
            include: {
              inventory: {
                where: { date: { gte: dateOnly(new Date()) } },
                orderBy: { date: 'asc' },
                take: 60,
              },
            },
          })
        );
      }
      if (path[1] === 'tours' && (method === 'POST' || method === 'PATCH')) {
        authorize(user, 'catalog:write');
        const input = tourSchema.parse(await body(request));
        const result = await serializable(async (tx) => {
          const { date, total, ...data } = input;
          const id = path[2] ?? `tour-${randomUUID()}`;
          if (method === 'PATCH')
            assert(
              await tx.offer.findFirst({ where: { id, product: 'TOUR' } }),
              404,
              'NOT_FOUND',
              'تور یافت نشد.'
            );
          const offer = await tx.offer.upsert({
            where: { id },
            create: {
              ...data,
              id,
              product: 'TOUR',
              supplierId: 'demo-travel',
              image: '/images/istanbul.jpg',
            },
            update: data,
          });
          const existing = await tx.inventory.findUnique({
            where: { offerId_date: { offerId: id, date: dateOnly(date) } },
          });
          const sold = existing ? existing.total - existing.available : 0;
          assert(total >= sold, 409, 'CAPACITY', 'ظرفیت نمی‌تواند کمتر از تعداد رزروشده باشد.');
          await tx.inventory.upsert({
            where: { offerId_date: { offerId: id, date: dateOnly(date) } },
            create: { offerId: id, date: dateOnly(date), total, available: total },
            update: { total, available: total - sold },
          });
          await audit(tx, user.id, 'TOUR_SAVED', undefined, { offerId: id });
          return offer;
        });
        return json(result);
      }
      if (path[1] === 'hotels' && method === 'GET') {
        authorize(user, 'catalog:write');
        return json(
          await db.offer.findMany({
            where: { product: 'HOTEL' },
            include: {
              inventory: {
                where: { date: { gte: dateOnly(new Date()) } },
                orderBy: { date: 'asc' },
                take: 60,
              },
            },
          })
        );
      }
      if (path[1] === 'hotels' && path[2] && method === 'PATCH') {
        authorize(user, 'catalog:write');
        const input = z
          .object({
            title: z.string().min(3).max(120),
            subtitle: z.string().max(200),
            priceIrr: z.number().int().positive().max(1_000_000_000),
            published: z.boolean(),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            total: z.number().int().min(0).max(500),
            details: z.object({
              roomType: z.string().min(3).max(120),
              stars: z.number().int().min(1).max(5),
              amenities: z.array(z.string().max(100)).max(30),
              rules: z.string().max(3000),
            }),
          })
          .parse(await body(request));
        const result = await serializable(async (tx) => {
          const hotel = await tx.offer.findFirst({ where: { id: path[2], product: 'HOTEL' } });
          assert(hotel, 404, 'NOT_FOUND', 'هتل یافت نشد.');
          const inv = await tx.inventory.findUnique({
            where: { offerId_date: { offerId: hotel.id, date: dateOnly(input.date) } },
          });
          const sold = inv ? inv.total - inv.available : 0;
          assert(input.total >= sold, 409, 'CAPACITY', 'ظرفیت کمتر از رزروهای ثبت‌شده است.');
          await tx.inventory.upsert({
            where: { offerId_date: { offerId: hotel.id, date: dateOnly(input.date) } },
            create: {
              offerId: hotel.id,
              date: dateOnly(input.date),
              total: input.total,
              available: input.total,
            },
            update: { total: input.total, available: input.total - sold },
          });
          const updated = await tx.offer.update({
            where: { id: hotel.id },
            data: {
              title: input.title,
              subtitle: input.subtitle,
              priceIrr: input.priceIrr,
              published: input.published,
              details: {
                ...(hotel.details as Prisma.JsonObject),
                ...input.details,
              } as Prisma.InputJsonValue,
            },
          });
          await audit(tx, user.id, 'HOTEL_SAVED', undefined, { offerId: hotel.id });
          return updated;
        });
        return json(result);
      }
      if (path[1] === 'finance' && method === 'GET') {
        authorize(user, 'finance:read');
        const rows = await db.reservation.findMany({
          include: { payment: true },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        const safe = (v: unknown) =>
          `"${String(v ?? '')
            .replace(/^[=+@-]/, "'")
            .replaceAll('"', '""')}"`;
        const csv =
          '\uFEFF' +
          [
            ['reference', 'amount_IRR', 'payment', 'booking', 'provider', 'demo'],
            ...rows.map((r) => [
              r.reference,
              r.totalIrr,
              r.paymentStatus,
              r.status,
              r.payment?.provider ?? '',
              true,
            ]),
          ]
            .map((r) => r.map(safe).join(','))
            .join('\r\n');
        await db.auditLog.create({ data: { actorId: user.id, action: 'FINANCE_EXPORTED' } });
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="berjis-DEMO-finance.csv"',
            'Cache-Control': 'no-store',
          },
        });
      }
      if (path[1] === 'audit' && method === 'GET') {
        authorize(user, 'audit:read');
        return json(await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }));
      }
      if (path[1] === 'support' && method === 'GET') {
        authorize(user, 'support:write');
        return json(await db.supportTicket.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }));
      }
      if (path[1] === 'support' && path[2] && method === 'POST') {
        authorize(user, 'support:write');
        const { reply } = z
          .object({ reply: z.string().min(5).max(3000) })
          .parse(await body(request));
        await db.$transaction(async (tx) => {
          await tx.supportTicket.update({
            where: { id: path[2] },
            data: { reply, status: 'ANSWERED' },
          });
          await audit(tx, user.id, 'SUPPORT_REPLIED', undefined, { ticketId: path[2] });
        });
        return json({ ok: true });
      }
      if (path[1] === 'users' && method === 'GET') {
        authorize(user, 'users:write');
        return json(
          await db.user.findMany({
            select: { id: true, name: true, email: true, role: true },
            take: 100,
          })
        );
      }
      if (path[1] === 'users' && path[2] && method === 'PATCH') {
        authorize(user, 'users:write');
        const { role } = z
          .object({
            role: z.enum([
              'CUSTOMER',
              'SUPPORT',
              'BOOKING_AGENT',
              'SALES_MANAGER',
              'ACCOUNTANT',
              'SUPER_ADMIN',
            ]),
          })
          .parse(await body(request));
        assert(path[2] !== user.id, 409, 'SELF_ROLE', 'تغییر نقش خودتان از این مسیر مجاز نیست.');
        await db.$transaction(async (tx) => {
          await tx.user.update({ where: { id: path[2] }, data: { role } });
          await audit(tx, user.id, 'ROLE_CHANGED', undefined, { userId: path[2], role });
        });
        return json({ ok: true });
      }
      if (path[1] === 'suppliers' && method === 'GET') {
        authorize(user, 'catalog:write');
        return json(await db.supplier.findMany());
      }
      if (path[1] === 'articles' && method === 'GET') {
        authorize(user, 'content:write');
        return json(await db.article.findMany());
      }
      if (path[1] === 'articles' && path[2] && method === 'PATCH') {
        authorize(user, 'content:write');
        const input = z
          .object({
            title: z.string().min(3).max(150),
            excerpt: z.string().max(500),
            body: z.string().min(20).max(30000),
            published: z.boolean(),
          })
          .parse(await body(request));
        await db.$transaction(async (tx) => {
          await tx.article.update({ where: { id: path[2] }, data: input });
          await audit(tx, user.id, 'ARTICLE_UPDATED', undefined, { articleId: path[2] });
        });
        return json({ ok: true });
      }
      throw new AppError(404, 'NOT_FOUND', 'مسیر مدیریت یافت نشد.');
    }
    throw new AppError(404, 'NOT_FOUND', 'مسیر یافت نشد.');
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
