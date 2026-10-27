import { cleanupFixtures } from './helpers/fixtures';
import { serializable } from '../src/server/transaction';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { db } from '../src/server/db';
import { redis } from '../src/server/redis';
import { createReservation, expireHolds, cancelOrder } from '../src/server/services/reservations';
import { beginPayment, simulatePayment, processCallback } from '../src/server/services/payments';
import { fulfilReservation, settleRefund } from '../src/server/services/fulfilment';
import { searchOffers, dateOnly, addDays } from '../src/server/services/catalog';
import {
  hash,
  passwordHash,
  passwordMatches,
  encryptPii,
  signature,
  verifySignature,
  createSession,
} from '../src/server/security';
import { GET, POST, PATCH } from '../src/app/api/v1/[...path]/route';
import type { Product } from '@prisma/client';
const fixtureUsers: string[] = [];
const fixtureOffers: string[] = [];
const uid = randomUUID().replaceAll('-', '');
const start = dateOnly(addDays(new Date(), 5));
const date = start.toISOString().slice(0, 10);
let userId: string, otherId: string, cookie: string;
async function fixture(product: Product = 'FLIGHT', capacity = 6, manual = false) {
  const id = `test-${randomUUID()}`;
  const offer = await db.offer.create({
    data: {
      id,
      supplierId: 'demo-travel',
      product,
      title: 'آزمایشی',
      subtitle: 'تست',
      origin: 'تهران',
      destination: 'کیش',
      priceIrr: 10000000,
      image: '/images/kish.jpg',
      details: { manualConfirmation: manual, fromCode: 'THR', toCode: 'KIH', international: false },
    },
  });
  await db.inventory.createMany({
    data: Array.from({ length: 5 }, (_, i) => ({
      offerId: id,
      date: addDays(start, i),
      total: capacity,
      available: capacity,
    })),
  });
  fixtureOffers.push(offer.id);
  return offer;
}
function input(offerId: string, product: Product = 'FLIGHT', quantity = 1) {
  return {
    items: [
      {
        offerId,
        startDate: date,
        endDate: product === 'HOTEL' ? addDays(start, 3).toISOString().slice(0, 10) : date,
        quantity,
      },
    ],
    passengers: Array.from({ length: quantity }, () => ({
      firstName: 'Demo',
      lastName: 'Traveler',
      birthDate: '1990-01-01',
      documentNumber: 'DEMO123456',
    })),
    expectedTotalIrr: 10000000 * quantity * (product === 'HOTEL' ? 3 : 1),
  };
}
async function order(product: Product = 'FLIGHT', manual = false) {
  const o = await fixture(product, 6, manual);
  const r = await createReservation(userId, input(o.id, product), randomUUID());
  return { offer: o, r };
}
async function request(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  data?: unknown,
  headers: Record<string, string> = {}
) {
  const req = new Request(`http://localhost:3000/api/v1/${path}`, {
    method,
    headers: {
      Origin: 'http://localhost:3000',
      'Content-Type': 'application/json',
      Cookie: cookie,
      ...headers,
    },
    ...(method !== 'GET' ? { body: JSON.stringify(data ?? {}) } : {}),
  });
  return { GET, POST, PATCH }[method](req, { params: Promise.resolve({ path: path.split('/') }) });
}
beforeAll(async () => {
  await db.supplier.upsert({
    where: { id: 'demo-travel' },
    create: { id: 'demo-travel', name: 'test', mode: 'DEMO' },
    update: {},
  });
  const password = await passwordHash('Strong-test-password-2026');
  const user = await db.user.create({
    data: { email: `${uid}@example.test`, name: 'Demo User', passwordHash: password },
  });
  userId = user.id;
  otherId = (
    await db.user.create({
      data: { email: `other-${uid}@example.test`, name: 'Other User', passwordHash: password },
    })
  ).id;
  cookie = (await createSession(userId)).split(';')[0];
  fixtureUsers.push(userId, otherId);
});
afterAll(async () => {
  await cleanupFixtures(fixtureUsers, fixtureOffers);
  await db.$disconnect();
  await redis.quit();
});
describe('security and server authorization', () => {
  it('hashes passwords with per-password salt and rejects wrong passwords', async () => {
    const a = await passwordHash('test-password-1234'),
      b = await passwordHash('test-password-1234');
    expect(a).not.toBe(b);
    expect(await passwordMatches('test-password-1234', a)).toBe(true);
    expect(await passwordMatches('wrong-password', a)).toBe(false);
  });
  it('encrypts document numbers with randomized authenticated encryption', () => {
    const a = encryptPii('DEMO123456');
    expect(a).not.toContain('DEMO123456');
    expect(a).not.toBe(encryptPii('DEMO123456'));
    expect(a.split('.')).toHaveLength(3);
  });
  it('verifies callback HMAC and rejects modified content', () => {
    const raw = '{"event":"test"}';
    expect(verifySignature(raw, signature(raw))).toBe(true);
    expect(verifySignature(raw + ' ', signature(raw))).toBe(false);
    expect(verifySignature(raw, 'zz')).toBe(false);
  });
  it('denies cross-origin writes', async () => {
    expect(
      (await request('POST', 'orders', {}, { Origin: 'https://attacker.invalid' })).status
    ).toBe(403);
  });
  it('denies customer access to admin and role escalation', async () => {
    expect((await request('GET', 'admin/overview')).status).toBe(403);
    expect((await request('PATCH', `admin/users/${otherId}`, { role: 'SUPER_ADMIN' })).status).toBe(
      403
    );
  });
  it('hides another customer’s order', async () => {
    const { r } = await order();
    const otherCookie = (await createSession(otherId)).split(';')[0];
    expect(
      (await request('GET', `orders/${r.id}`, undefined, { Cookie: otherCookie })).status
    ).toBe(404);
  });
  it('rejects unauthenticated purchases', async () => {
    expect((await request('POST', 'orders', {}, { Cookie: '' })).status).toBe(401);
  });
  it('rejects forged callback signatures', async () => {
    expect(
      (
        await request('POST', 'payments/callback', {
          providerReference: 'fake',
          eventId: 'fake-event',
        })
      ).status
    ).toBe(403);
  });
  it('does not expose encrypted documents or passwords in order responses', async () => {
    const { r } = await order();
    const res = await request('GET', `orders/${r.id}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('DEMO123456');
    expect(text).not.toContain('documentCipher');
    expect(text).not.toContain('passwordHash');
  });
});
describe('catalog search', () => {
  it('isolates cached offers between Redis namespaces', async () => {
    const f = await fixture();
    const destination = `namespace-${randomUUID()}`;
    await db.offer.update({ where: { id: f.id }, data: { destination } });
    const original = process.env.REDIS_NAMESPACE;
    const query = { product: 'FLIGHT', destination, startDate: date, endDate: date, quantity: 1 };
    try {
      process.env.REDIS_NAMESPACE = `${original}-a`;
      expect((await searchOffers(query)).some((o: { id: string }) => o.id === f.id)).toBe(true);
      await db.offer.update({ where: { id: f.id }, data: { published: false } });
      process.env.REDIS_NAMESPACE = `${original}-b`;
      expect((await searchOffers(query)).some((o: { id: string }) => o.id === f.id)).toBe(false);
    } finally {
      process.env.REDIS_NAMESPACE = original;
    }
  });

  it('resolves IATA airport search and restricts the selected airport', async () => {
    await fixture();
    const offers = await searchOffers({
      product: 'FLIGHT',
      origin: 'THR',
      destination: 'KIH',
      startDate: date,
      endDate: date,
      quantity: 1,
    });
    expect(offers.length).toBeGreaterThan(0);
    expect(
      offers.every(
        (o: { origin: string; details: { fromCode: string; toCode: string } }) =>
          o.origin === 'تهران' && o.details.fromCode === 'THR' && o.details.toCode === 'KIH'
      )
    ).toBe(true);
  });
  it('filters domestic versus international offers in the server', async () => {
    const f = await fixture();
    await db.offer.update({
      where: { id: f.id },
      data: {
        destination: 'استانبول',
        details: { fromCode: 'IKA', toCode: 'IST', international: true },
      },
    });
    const foreign = await searchOffers({
      product: 'FLIGHT',
      origin: 'تهران',
      flightType: 'international',
      startDate: date,
      endDate: date,
      quantity: 1,
    });
    expect(foreign.some((o: { id: string }) => o.id === f.id)).toBe(true);
    const domestic = await searchOffers({
      product: 'FLIGHT',
      origin: 'تهران',
      flightType: 'domestic',
      startDate: date,
      endDate: date,
      quantity: 1,
    });
    expect(domestic.some((o: { id: string }) => o.id === f.id)).toBe(false);
  });
});
describe('transactional holds and quotes', () => {
  it('creates only one reservation for concurrent identical idempotency keys', async () => {
    const f = await fixture();
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createReservation(userId, input(f.id), key))
    );
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(
      (await db.inventory.findUnique({ where: { offerId_date: { offerId: f.id, date: start } } }))
        ?.available
    ).toBe(5);
  });
  it('rejects key reuse with different payload', async () => {
    const f = await fixture();
    const key = randomUUID();
    await createReservation(userId, input(f.id), key);
    await expect(
      createReservation(userId, { ...input(f.id), expectedTotalIrr: 1 }, key)
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it('allows exactly one buyer for the last seat under concurrency', async () => {
    const f = await fixture('TOUR', 1);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => createReservation(userId, input(f.id, 'TOUR'), randomUUID()))
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await db.inventory.findUnique({ where: { offerId_date: { offerId: f.id, date: start } } }))
        ?.available
    ).toBe(0);
  });
  it('rejects manipulated client prices and rolls back capacity', async () => {
    const f = await fixture();
    await expect(
      createReservation(userId, { ...input(f.id), expectedTotalIrr: 1000 }, randomUUID())
    ).rejects.toMatchObject({ code: 'PRICE_CHANGED' });
    expect(
      (await db.inventory.findUnique({ where: { offerId_date: { offerId: f.id, date: start } } }))
        ?.available
    ).toBe(6);
  });
  it('holds all hotel nights and releases each exactly once', async () => {
    const { offer, r } = await order('HOTEL');
    const nights = await db.inventory.findMany({
      where: { offerId: offer.id, date: { gte: start, lt: addDays(start, 3) } },
    });
    expect(nights.map((n) => n.available)).toEqual([5, 5, 5]);
    await db.reservation.update({
      where: { id: r.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expireHolds();
    await expireHolds();
    const released = await db.inventory.findMany({
      where: { offerId: offer.id, date: { gte: start, lt: addDays(start, 3) } },
    });
    expect(released.map((n) => n.available)).toEqual([6, 6, 6]);
  });
  it('does not oversell overlapping hotel stays', async () => {
    const f = await fixture('HOTEL', 1);
    await createReservation(userId, input(f.id, 'HOTEL'), randomUUID());
    await expect(
      createReservation(otherId, input(f.id, 'HOTEL'), randomUUID())
    ).rejects.toMatchObject({ code: 'SOLD_OUT' });
  });
  it('rejects zero-night hotel stays', async () => {
    const f = await fixture('HOTEL');
    const v = input(f.id, 'HOTEL');
    v.items[0].endDate = date;
    await expect(createReservation(userId, v, randomUUID())).rejects.toMatchObject({
      code: 'DATES',
    });
  });
  it('rejects passenger/capacity mismatch', async () => {
    const f = await fixture();
    const v = input(f.id);
    v.items[0].quantity = 2;
    await expect(createReservation(userId, v, randomUUID())).rejects.toMatchObject({
      code: 'PASSENGERS',
    });
  });
  it('rolls back every leg if a later flight leg has no capacity', async () => {
    const a = await fixture(),
      b = await fixture('FLIGHT', 0);
    const v = input(a.id);
    v.items.push({
      ...v.items[0],
      offerId: b.id,
      startDate: addDays(start, 1).toISOString().slice(0, 10),
      endDate: addDays(start, 1).toISOString().slice(0, 10),
    });
    v.expectedTotalIrr *= 2;
    await expect(createReservation(userId, v, randomUUID())).rejects.toMatchObject({
      code: 'SOLD_OUT',
    });
    expect(
      (await db.inventory.findUnique({ where: { offerId_date: { offerId: a.id, date: start } } }))
        ?.available
    ).toBe(6);
  });
  it('rejects payments after hold expiry', async () => {
    const { r } = await order();
    await db.reservation.update({
      where: { id: r.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(beginPayment(userId, r.id)).rejects.toMatchObject({ code: 'HOLD_EXPIRED' });
  });
  it('cancels unpaid orders without double releasing capacity', async () => {
    const { r, offer } = await order();
    await cancelOrder(userId, r.id, 'test cancellation');
    await cancelOrder(userId, r.id, 'test replay');
    expect(
      (
        await db.inventory.findUnique({
          where: { offerId_date: { offerId: offer.id, date: start } },
        })
      )?.available
    ).toBe(6);
  });
});
describe('recovery and operations', () => {
  it('retries an actual PostgreSQL deadlock without leaking partial writes', async () => {
    const a = await fixture(),
      b = await fixture();
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const attempts = [0, 0];
    async function participant(index: number, first: string, second: string) {
      return serializable(async (tx) => {
        attempts[index]++;
        await tx.$executeRaw`UPDATE "Inventory" SET "total"="total"+1,"available"="available"+1 WHERE "offerId"=${first} AND "date"=${start}`;
        if (attempts[index] === 1) {
          if (++arrived === 2) release();
          await barrier;
        }
        await tx.$executeRaw`UPDATE "Inventory" SET "total"="total"+1,"available"="available"+1 WHERE "offerId"=${second} AND "date"=${start}`;
      });
    }
    await Promise.all([participant(0, a.id, b.id), participant(1, b.id, a.id)]);
    expect(attempts[0] + attempts[1]).toBeGreaterThanOrEqual(3);
    const stock = await db.inventory.findMany({
      where: { offerId: { in: [a.id, b.id] }, date: start },
    });
    expect(stock.map((s) => s.available)).toEqual([8, 8]);
    expect(stock.map((s) => s.total)).toEqual([8, 8]);
  });

  it('does not cancel a hold when a callback arrives before a final provider result', async () => {
    const { r } = await order();
    const p = await beginPayment(userId, r.id);
    await expect(
      processCallback({ providerReference: p.providerReference, eventId: `pending-${p.id}` })
    ).rejects.toMatchObject({ code: 'PAYMENT_PENDING' });
    expect((await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe(
      'AWAITING_PAYMENT'
    );
    expect(await db.paymentEvent.count({ where: { paymentId: p.id } })).toBe(0);
  });
  it('handles expiration racing a successful callback without leaking or duplicating capacity', async () => {
    const { r, offer } = await order();
    const p = await beginPayment(userId, r.id);
    await db.reservation.update({
      where: { id: r.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await Promise.all([expireHolds(), simulatePayment(userId, p.id, 'SUCCESS')]);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).paymentStatus).toBe(
      'REFUND_PENDING'
    );
    expect(
      (
        await db.inventory.findUnique({
          where: { offerId_date: { offerId: offer.id, date: start } },
        })
      )?.available
    ).toBe(6);
  });
  it('rejects a provider currency mismatch', async () => {
    const { r } = await order();
    const p = await beginPayment(userId, r.id);
    await db.demoGatewayTransaction.update({
      where: { paymentId: p.id },
      data: { status: 'SUCCEEDED', currency: 'USD' },
    });
    await expect(
      processCallback({ providerReference: p.providerReference, eventId: `currency-${p.id}` })
    ).rejects.toMatchObject({ code: 'CURRENCY_MISMATCH' });
  });
  it('keeps one user notification per event when callbacks and issuance replay', async () => {
    const { r } = await order();
    const p = await beginPayment(userId, r.id);
    await simulatePayment(userId, p.id, 'SUCCESS');
    await simulatePayment(userId, p.id, 'SUCCESS');
    await fulfilReservation(r.id);
    await fulfilReservation(r.id);
    expect(
      await db.notification.count({
        where: { reservationId: r.id, title: 'سند DEMO پس از تأیید تأمین‌کننده صادر شد' },
      })
    ).toBe(1);
  });
  it('supports a valid two-leg itinerary transaction', async () => {
    const a = await fixture(),
      b = await fixture();
    await db.offer.update({ where: { id: b.id }, data: { origin: 'کیش', destination: 'تهران' } });
    const v = input(a.id);
    const next = addDays(start, 1).toISOString().slice(0, 10);
    v.items.push({ ...v.items[0], offerId: b.id, startDate: next, endDate: next });
    v.expectedTotalIrr *= 2;
    const r = await createReservation(userId, v, randomUUID());
    expect(await db.bookingItem.count({ where: { reservationId: r.id } })).toBe(2);
    expect(r.totalIrr).toBe(20000000);
  });
  it('records role changes and enforces the accountant permissions', async () => {
    const admin = await db.user.create({
      data: {
        email: `admin-${randomUUID()}@example.test`,
        name: 'Test Admin',
        passwordHash: 'unused-test-fixture',
        role: 'SUPER_ADMIN',
      },
    });
    fixtureUsers.push(admin.id);
    const adminCookie = (await createSession(admin.id)).split(';')[0];
    expect(
      (
        await request(
          'PATCH',
          `admin/users/${otherId}`,
          { role: 'ACCOUNTANT' },
          { Cookie: adminCookie }
        )
      ).status
    ).toBe(200);
    const accountCookie = (await createSession(otherId)).split(';')[0];
    expect(
      (await request('GET', 'admin/finance', undefined, { Cookie: accountCookie })).status
    ).toBe(200);
    expect((await request('GET', 'admin/tours', undefined, { Cookie: accountCookie })).status).toBe(
      403
    );
    expect(await db.auditLog.count({ where: { actorId: admin.id, action: 'ROLE_CHANGED' } })).toBe(
      1
    );
  });
  it('approved cancellation refunds once and releases issued capacity once', async () => {
    const { r, offer } = await order();
    const p = await beginPayment(userId, r.id);
    await simulatePayment(userId, p.id, 'SUCCESS');
    await fulfilReservation(r.id);
    await cancelOrder(userId, r.id, 'test customer request');
    await cancelOrder(userId, r.id, 'test replay');
    const refund = await db.refund.findFirstOrThrow({ where: { reservationId: r.id } });
    expect(await db.refund.count({ where: { reservationId: r.id } })).toBe(1);
    const admin = await db.user.create({
      data: {
        email: `refund-admin-${randomUUID()}@example.test`,
        name: 'Test Admin',
        passwordHash: 'unused-fixture',
        role: 'ACCOUNTANT',
      },
    });
    fixtureUsers.push(admin.id);
    const adminCookie = (await createSession(admin.id)).split(';')[0];
    expect(
      (await request('POST', `admin/refunds/${refund.id}`, {}, { Cookie: adminCookie })).status
    ).toBe(200);
    await settleRefund(r.id);
    await settleRefund(r.id);
    expect(
      (
        await db.inventory.findUnique({
          where: { offerId_date: { offerId: offer.id, date: start } },
        })
      )?.available
    ).toBe(6);
    expect((await request('GET', `orders/${r.id}/receipt`)).status).toBe(409);
  });
});
describe('independent payment, booking and fulfilment states', () => {
  it.each(['FLIGHT', 'HOTEL', 'TOUR'] as const)(
    'completes a %s purchase and creates only a DEMO document after confirmation',
    async (product) => {
      const { r } = await order(product);
      const p = await beginPayment(userId, r.id);
      expect((await beginPayment(userId, r.id)).id).toBe(p.id);
      await simulatePayment(userId, p.id, 'SUCCESS');
      let saved = await db.reservation.findUniqueOrThrow({
        where: { id: r.id },
        include: { document: true },
      });
      expect(saved.paymentStatus).toBe('PAID');
      expect(saved.status).toBe('CONFIRMING');
      expect(saved.document).toBeNull();
      await fulfilReservation(r.id);
      await fulfilReservation(r.id);
      saved = await db.reservation.findUniqueOrThrow({
        where: { id: r.id },
        include: { document: true },
      });
      expect(saved.status).toBe('CONFIRMED');
      expect(saved.fulfilmentStatus).toBe('ISSUED');
      expect(saved.document?.demo).toBe(true);
      expect(await db.document.count({ where: { reservationId: r.id } })).toBe(1);
    }
  );
  it('deduplicates parallel callbacks and creates a single issuance outbox entry', async () => {
    const { r } = await order();
    const p = await beginPayment(userId, r.id);
    await db.demoGatewayTransaction.update({
      where: { paymentId: p.id },
      data: { status: 'SUCCEEDED' },
    });
    await Promise.all(
      Array.from({ length: 5 }, () =>
        processCallback({ providerReference: p.providerReference, eventId: `event-${p.id}` })
      )
    );
    expect(await db.paymentEvent.count({ where: { paymentId: p.id } })).toBe(1);
    expect(await db.durableJob.count({ where: { reservationId: r.id, kind: 'ISSUE' } })).toBe(1);
  });
  it('rejects a provider amount mismatch and never issues', async () => {
    const { r } = await order();
    const p = await beginPayment(userId, r.id);
    await db.demoGatewayTransaction.update({
      where: { paymentId: p.id },
      data: { status: 'SUCCEEDED', amountIrr: p.amountIrr - 1 },
    });
    await expect(
      processCallback({ providerReference: p.providerReference, eventId: `event-${p.id}` })
    ).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    expect(await db.document.count({ where: { reservationId: r.id } })).toBe(0);
  });
  it('does not confirm failed payments and releases the hold', async () => {
    const { r, offer } = await order();
    const p = await beginPayment(userId, r.id);
    await simulatePayment(userId, p.id, 'FAILED');
    await fulfilReservation(r.id);
    const saved = await db.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(saved.paymentStatus).toBe('FAILED');
    expect(saved.status).toBe('CANCELLED');
    expect(await db.document.count({ where: { reservationId: r.id } })).toBe(0);
    expect(
      (
        await db.inventory.findUnique({
          where: { offerId_date: { offerId: offer.id, date: start } },
        })
      )?.available
    ).toBe(6);
  });
  it('routes successful late payments to refund without taking capacity again', async () => {
    const { r, offer } = await order();
    const p = await beginPayment(userId, r.id);
    await db.reservation.update({
      where: { id: r.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expireHolds();
    await simulatePayment(userId, p.id, 'SUCCESS');
    const saved = await db.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(saved.paymentStatus).toBe('REFUND_PENDING');
    expect(saved.status).toBe('FAILED');
    expect(
      (
        await db.inventory.findUnique({
          where: { offerId_date: { offerId: offer.id, date: start } },
        })
      )?.available
    ).toBe(6);
    expect(await db.document.count({ where: { reservationId: r.id } })).toBe(0);
  });
  it('routes a payment received after cancellation to refund', async () => {
    const { r } = await order();
    const p = await beginPayment(userId, r.id);
    await cancelOrder(userId, r.id, 'user cancelled');
    await simulatePayment(userId, p.id, 'SUCCESS');
    expect((await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).paymentStatus).toBe(
      'REFUND_PENDING'
    );
  });
  it('separates supplier rejection from successful payment, then settles a demo refund once', async () => {
    const { r, offer } = await order();
    const p = await beginPayment(userId, r.id);
    await simulatePayment(userId, p.id, 'ISSUE_FAILURE');
    await fulfilReservation(r.id);
    let saved = await db.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(saved.status).toBe('FAILED');
    expect(saved.paymentStatus).toBe('REFUND_PENDING');
    expect(saved.fulfilmentStatus).toBe('FAILED');
    expect(await db.document.count({ where: { reservationId: r.id } })).toBe(0);
    await settleRefund(r.id);
    await settleRefund(r.id);
    saved = await db.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(saved.paymentStatus).toBe('REFUNDED');
    expect(
      (
        await db.inventory.findUnique({
          where: { offerId_date: { offerId: offer.id, date: start } },
        })
      )?.available
    ).toBe(6);
  });
  it('requires manual approval for a manual-confirmation tour', async () => {
    const { r } = await order('TOUR', true);
    const p = await beginPayment(userId, r.id);
    await simulatePayment(userId, p.id, 'SUCCESS');
    await fulfilReservation(r.id);
    expect(await db.document.count({ where: { reservationId: r.id } })).toBe(0);
    expect((await db.durableJob.findUnique({ where: { key: `issue-${r.id}` } }))?.status).toBe(
      'WAITING_MANUAL'
    );
    await fulfilReservation(r.id, true);
    expect(await db.document.count({ where: { reservationId: r.id } })).toBe(1);
  });
  it('never downloads an unissued document', async () => {
    const { r } = await order();
    expect((await request('GET', `orders/${r.id}/receipt`)).status).toBe(409);
  });
  it('accepts a correctly signed callback without trusting payload money', async () => {
    const { r } = await order();
    const p = await beginPayment(userId, r.id);
    await db.demoGatewayTransaction.update({
      where: { paymentId: p.id },
      data: { status: 'SUCCEEDED' },
    });
    const payload = {
      providerReference: p.providerReference,
      eventId: `signed-${p.id}`,
      amountIrr: 1,
    };
    const res = await request('POST', 'payments/callback', payload, {
      'x-payment-signature': signature(JSON.stringify(payload)),
    });
    expect(res.status).toBe(200);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).totalIrr).toBe(
      10000000
    );
  });
});
