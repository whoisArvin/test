import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { assert } from '../errors';
import { serializable, lockReservation } from '../transaction';
import { demoOnly } from '../config';
import { demoGateway } from '../adapters/demo';
import { audit, releaseInventory } from './reservations';
export async function beginPayment(userId: string, reservationId: string) {
  demoOnly();
  return serializable(async (tx) => {
    await lockReservation(tx, reservationId);
    const r = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { payment: true },
    });
    assert(r?.userId === userId, 404, 'NOT_FOUND', 'سفارش یافت نشد.');
    assert(
      r.status === 'AWAITING_PAYMENT' && r.expiresAt > new Date(),
      409,
      'HOLD_EXPIRED',
      'مهلت رزرو تمام شده یا سفارش قابل پرداخت نیست.'
    );
    if (r.payment) return r.payment;
    const payment = await tx.payment.create({
      data: {
        reservationId,
        amountIrr: r.totalIrr,
        providerReference: `DEMO-${randomUUID()}`,
        gateway: { create: { amountIrr: r.totalIrr, orderId: r.id } },
      },
    });
    await tx.reservation.update({
      where: { id: reservationId },
      data: { paymentStatus: 'PROCESSING' },
    });
    await audit(tx, userId, 'PAYMENT_STARTED', reservationId);
    return payment;
  });
}
export async function processCallback(input: { providerReference: string; eventId: string }) {
  // The signed payload identifies the transaction. Payment facts come from server-to-server verification.
  const verified = await demoGateway.verify(input.providerReference);
  assert(
    verified.status !== 'PENDING',
    409,
    'PAYMENT_PENDING',
    'درگاه هنوز نتیجه نهایی را اعلام نکرده است.'
  );
  return serializable(async (tx) => {
    await lockReservation(tx, verified.orderId);
    const payment = await tx.payment.findUnique({
      where: { providerReference: input.providerReference },
      include: { reservation: true },
    });
    assert(payment, 404, 'NOT_FOUND', 'تراکنش یافت نشد.');
    assert(
      verified.orderId === payment.reservationId &&
        verified.amountIrr === payment.amountIrr &&
        verified.currency === payment.currency &&
        payment.amountIrr === payment.reservation.totalIrr &&
        payment.currency === payment.reservation.currency,
      409,
      'PAYMENT_MISMATCH',
      'اطلاعات تأیید تراکنش مطابقت ندارد.'
    );
    const seen = await tx.paymentEvent.findUnique({ where: { providerEventId: input.eventId } });
    if (seen) {
      assert(seen.paymentId === payment.id, 409, 'EVENT_CONFLICT', 'شناسه رویداد تکراری است.');
      return payment.reservation;
    }
    if (payment.verifiedAt) return payment.reservation;
    const r = payment.reservation;
    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        providerEventId: input.eventId,
        kind: verified.paid ? 'VERIFIED' : 'FAILED',
      },
    });
    if (!verified.paid) {
      if (r.status === 'AWAITING_PAYMENT') {
        await releaseInventory(tx, r.id);
        await tx.reservation.update({
          where: { id: r.id },
          data: { status: 'CANCELLED', paymentStatus: 'FAILED' },
        });
      }
      await audit(tx, 'gateway', 'PAYMENT_FAILED', r.id);
    } else {
      await tx.payment.update({ where: { id: payment.id }, data: { verifiedAt: new Date() } });
      if (r.status !== 'AWAITING_PAYMENT' || r.expiresAt < new Date()) {
        if (r.status === 'AWAITING_PAYMENT') await releaseInventory(tx, r.id);
        await tx.reservation.update({
          where: { id: r.id },
          data: { status: 'FAILED', paymentStatus: 'REFUND_PENDING' },
        });
        await tx.refund.create({
          data: {
            reservationId: r.id,
            reason: 'DEMO: پرداخت پس از پایان مهلت یا لغو سفارش',
            status: 'APPROVED',
            amountIrr: r.totalIrr,
          },
        });
        await tx.durableJob.upsert({
          where: { key: `refund-${r.id}` },
          create: { key: `refund-${r.id}`, kind: 'REFUND', reservationId: r.id },
          update: {},
        });
        await audit(tx, 'gateway', 'LATE_PAYMENT_REFUND_REQUIRED', r.id);
      } else {
        await tx.reservation.update({
          where: { id: r.id },
          data: { paymentStatus: 'PAID', status: 'CONFIRMING', fulfilmentStatus: 'PENDING' },
        });
        await tx.durableJob.upsert({
          where: { key: `issue-${r.id}` },
          create: { key: `issue-${r.id}`, kind: 'ISSUE', reservationId: r.id },
          update: {},
        });
        await audit(tx, 'gateway', 'PAYMENT_VERIFIED', r.id, {
          amountIrr: payment.amountIrr,
          mode: 'DEMO',
        });
      }
    }
    return tx.reservation.findUnique({ where: { id: r.id } });
  });
}
export async function simulatePayment(
  userId: string,
  paymentId: string,
  outcome: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'ISSUE_FAILURE'
) {
  demoOnly();
  const p = await db.payment.findUnique({
    where: { id: paymentId },
    include: { reservation: true, gateway: true },
  });
  assert(p?.reservation.userId === userId, 404, 'NOT_FOUND', 'تراکنش یافت نشد.');
  await db.demoGatewayTransaction.updateMany({
    where: { paymentId, status: 'PENDING' },
    data: {
      status: ['SUCCESS', 'ISSUE_FAILURE'].includes(outcome) ? 'SUCCEEDED' : outcome,
      failureScenario: outcome === 'ISSUE_FAILURE' ? 'ISSUE_FAILURE' : 'NONE',
    },
  });
  return processCallback({
    providerReference: p.providerReference,
    eventId: `demo-result-${p.id}`,
  });
}
