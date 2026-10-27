import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { db } from '../db';
import { assert } from '../errors';
import { bookingSchema, type BookingInput } from '../validation';
import { hash, encryptPii } from '../security';
import { serializable, lockReservation } from '../transaction';
import { dateOnly, inventoryDates } from './catalog';
import { demoOnly } from '../config';
export const orderInclude = {
  items: { include: { offer: true } },
  passengers: { select: { id: true, firstName: true, lastName: true, birthDate: true } },
  payment: { select: { id: true, amountIrr: true, provider: true, verifiedAt: true } },
  document: true,
  refunds: true,
  audits: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ReservationInclude;
export async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  reservationId?: string,
  metadata?: Prisma.InputJsonValue
) {
  await tx.auditLog.create({ data: { actorId, action, reservationId, metadata } });
  const messages: Record<string, string> = {
    RESERVATION_HELD: 'رزرو موقت آزمایشی ایجاد شد',
    PAYMENT_VERIFIED: 'پرداخت آزمایشی در سرور تأیید شد',
    DEMO_DOCUMENT_ISSUED: 'سند DEMO پس از تأیید تأمین‌کننده صادر شد',
    PAYMENT_FAILED: 'پرداخت آزمایشی ناموفق بود',
    SUPPLIER_REJECTED_REFUND_PENDING: 'صدور ناموفق؛ استرداد آزمایشی در حال پیگیری است',
    REFUND_SETTLED_DEMO: 'استرداد آزمایشی انجام شد',
    HOLD_EXPIRED: 'مهلت رزرو موقت پایان یافت',
    REFUND_APPROVED: 'درخواست استرداد شما تأیید شد',
  };
  if (reservationId && messages[action]) {
    const r = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: { userId: true },
    });
    if (r)
      await tx.notification.upsert({
        where: { eventKey: `${reservationId}-${action}` },
        create: {
          eventKey: `${reservationId}-${action}`,
          userId: r.userId,
          reservationId,
          title: messages[action],
        },
        update: {},
      });
  }
}
export async function releaseInventory(tx: Prisma.TransactionClient, reservationId: string) {
  const items = await tx.bookingItem.findMany({
    where: { reservationId },
    include: { offer: true },
  });
  for (const item of items)
    for (const date of inventoryDates(item.offer.product, item.startDate, item.endDate)) {
      await tx.inventory.update({
        where: { offerId_date: { offerId: item.offerId, date } },
        data: { available: { increment: item.quantity } },
      });
    }
}
export async function createReservation(userId: string, raw: unknown, idempotencyKey: string) {
  demoOnly();
  assert(
    /^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey),
    422,
    'IDEMPOTENCY_KEY',
    'شناسه درخواست معتبر نیست.'
  );
  const input = bookingSchema.parse(raw);
  const requestHash = hash(JSON.stringify(input));
  return serializable(async (tx) => {
    const existing = await tx.reservation.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (existing) {
      assert(
        existing.requestHash === requestHash,
        409,
        'IDEMPOTENCY_CONFLICT',
        'این شناسه برای درخواست دیگری استفاده شده است.'
      );
      return existing;
    }
    assert(
      new Set(input.items.map((i) => `${i.offerId}:${i.startDate}`)).size === input.items.length,
      422,
      'DUPLICATE_ITEM',
      'بخش تکراری در برنامه سفر وجود دارد.'
    );
    const lines: Array<{
      offerId: string;
      startDate: Date;
      endDate: Date;
      quantity: number;
      unitIrr: number;
      snapshot: Prisma.InputJsonValue;
      product: 'FLIGHT' | 'HOTEL' | 'TOUR';
    }> = [];
    let totalIrr = 0;
    for (const item of input.items) {
      const offer = await tx.offer.findUnique({ where: { id: item.offerId } });
      assert(offer?.published, 404, 'OFFER_UNAVAILABLE', 'پیشنهاد دیگر در دسترس نیست.');
      assert(
        offer.supplierId === 'demo-travel',
        503,
        'SUPPLIER_NOT_CONFIGURED',
        'تأمین‌کننده این پیشنهاد هنوز متصل نیست.'
      );
      const start = dateOnly(item.startDate),
        end = dateOnly(item.endDate);
      assert(
        start >= dateOnly(new Date()) && start <= new Date(Date.now() + 90 * 86400000),
        422,
        'DATE_RANGE',
        'تاریخ سفر باید در ۹۰ روز آینده باشد.'
      );
      const dates = inventoryDates(offer.product, start, end);
      assert(
        offer.product === 'HOTEL' || start.getTime() === end.getTime(),
        422,
        'DATES',
        'برای هر مسیر یک تاریخ انتخاب کنید.'
      );
      assert(
        offer.product === 'HOTEL'
          ? input.passengers.length >= item.quantity && input.passengers.length <= item.quantity * 2
          : input.passengers.length === item.quantity,
        422,
        'PASSENGERS',
        'تعداد مسافران با ظرفیت انتخابی مطابقت ندارد (هر اتاق حداکثر دو نفر).'
      );
      for (const date of dates) {
        const held = await tx.inventory.updateMany({
          where: { offerId: offer.id, date, available: { gte: item.quantity } },
          data: { available: { decrement: item.quantity } },
        });
        assert(
          held.count === 1,
          409,
          'SOLD_OUT',
          'ظرفیت یا قیمت تغییر کرده است. دوباره جستجو کنید.'
        );
      }
      totalIrr += offer.priceIrr * item.quantity * dates.length;
      lines.push({
        ...item,
        startDate: start,
        endDate: end,
        unitIrr: offer.priceIrr,
        snapshot: {
          title: offer.title,
          details: offer.details,
          origin: offer.origin,
          destination: offer.destination,
          demo: true,
        } as Prisma.InputJsonValue,
        product: offer.product,
      });
    }
    assert(
      lines.every((l) => l.product === lines[0].product),
      422,
      'PRODUCT_MIX',
      'هر سفارش باید فقط یک نوع خدمت داشته باشد.'
    );
    if (lines[0].product === 'FLIGHT')
      for (let i = 1; i < lines.length; i++) {
        const previous = lines[i - 1].snapshot as { destination: string };
        const current = lines[i].snapshot as { origin: string };
        assert(
          previous.destination === current.origin && lines[i].startDate > lines[i - 1].startDate,
          422,
          'ITINERARY',
          'مقصد مسیر قبل و مبدأ مسیر بعد باید یکسان و تاریخ‌ها صعودی باشند.'
        );
      }
    assert(
      lines[0].product === 'FLIGHT' || lines.length === 1,
      422,
      'ITEMS',
      'برای هتل و تور یک پیشنهاد انتخاب کنید.'
    );
    assert(
      totalIrr === input.expectedTotalIrr,
      409,
      'PRICE_CHANGED',
      'قیمت تغییر کرده است؛ پیشنهاد را دوباره بررسی کنید.'
    );
    const reservation = await tx.reservation.create({
      data: {
        userId,
        idempotencyKey,
        requestHash,
        reference: `BJ-${randomBytes(5).toString('hex').toUpperCase()}`,
        product: lines[0].product,
        totalIrr,
        expiresAt: new Date(Date.now() + 15 * 60000),
        items: { create: lines.map(({ product, ...l }) => l) },
        passengers: {
          create: input.passengers.map(({ documentNumber, birthDate, ...p }) => ({
            ...p,
            birthDate: dateOnly(birthDate),
            documentCipher: encryptPii(documentNumber),
          })),
        },
      },
    });
    await audit(tx, userId, 'RESERVATION_HELD', reservation.id, { totalIrr, mode: 'DEMO' });
    return reservation;
  });
}
export async function expireHolds() {
  const holds = await db.reservation.findMany({
    where: { status: 'AWAITING_PAYMENT', expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  for (const hold of holds)
    await serializable(async (tx) => {
      await lockReservation(tx, hold.id);
      const updated = await tx.reservation.updateMany({
        where: { id: hold.id, status: 'AWAITING_PAYMENT', expiresAt: { lt: new Date() } },
        data: { status: 'EXPIRED' },
      });
      if (updated.count) {
        await releaseInventory(tx, hold.id);
        await audit(tx, 'system', 'HOLD_EXPIRED', hold.id);
      }
    });
  return holds.length;
}
export async function cancelOrder(userId: string, id: string, reason: string) {
  return serializable(async (tx) => {
    await lockReservation(tx, id);
    const r = await tx.reservation.findUnique({ where: { id } });
    assert(r?.userId === userId, 404, 'NOT_FOUND', 'سفارش یافت نشد.');
    if (['CANCELLED', 'CANCELLATION_REQUESTED', 'EXPIRED'].includes(r.status)) return r;
    if (r.status === 'AWAITING_PAYMENT') {
      await tx.reservation.update({ where: { id }, data: { status: 'CANCELLED' } });
      await releaseInventory(tx, id);
      await audit(tx, userId, 'UNPAID_CANCELLED', id);
    } else {
      assert(
        r.paymentStatus === 'PAID' && r.status === 'CONFIRMED',
        409,
        'STATE',
        'سفارش در مرحله پردازش است؛ پس از مشخص‌شدن نتیجه درخواست دهید.'
      );
      await tx.reservation.update({ where: { id }, data: { status: 'CANCELLATION_REQUESTED' } });
      await tx.refund.create({ data: { reservationId: id, reason, amountIrr: r.totalIrr } });
      await audit(tx, userId, 'CANCELLATION_REQUESTED', id);
    }
    return tx.reservation.findUnique({ where: { id } });
  });
}
