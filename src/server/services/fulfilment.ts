import { db } from '../db';
import { serializable } from '../transaction';
import { assert } from '../errors';
import { demoSupplier, demoGateway } from '../adapters/demo';
import { audit, releaseInventory } from './reservations';
export async function fulfilReservation(id: string, manualApproved = false) {
  const r = await db.reservation.findUnique({
    where: { id },
    include: { payment: { include: { gateway: true } }, items: { include: { offer: true } } },
  });
  if (
    !r ||
    r.fulfilmentStatus === 'ISSUED' ||
    r.paymentStatus !== 'PAID' ||
    r.status !== 'CONFIRMING'
  )
    return;
  if (
    !manualApproved &&
    r.items.some(
      (i) =>
        (i.snapshot as { details?: { manualConfirmation?: boolean } }).details?.manualConfirmation
    )
  ) {
    await db.durableJob.updateMany({
      where: { reservationId: id, kind: 'ISSUE' },
      data: { status: 'WAITING_MANUAL' },
    });
    return;
  }
  let confirmed;
  try {
    confirmed = await demoSupplier.confirm({
      reservationId: id,
      product: r.product,
      failureScenario: r.payment?.gateway?.failureScenario,
    });
  } catch (e) {
    // Known sandbox rejection is terminal. Unknown transport failures must be retried, never called a supplier rejection.
    if (!(e instanceof Error) || e.message !== 'DEMO_SUPPLIER_REJECTED') throw e;
    await serializable(async (tx) => {
      const updated = await tx.reservation.updateMany({
        where: { id, status: 'CONFIRMING', paymentStatus: 'PAID', fulfilmentStatus: 'PENDING' },
        data: { status: 'FAILED', fulfilmentStatus: 'FAILED', paymentStatus: 'REFUND_PENDING' },
      });
      if (!updated.count) return;
      await releaseInventory(tx, id);
      await tx.refund.create({
        data: {
          reservationId: id,
          reason: 'DEMO: تأمین‌کننده صدور را رد کرد',
          status: 'APPROVED',
          amountIrr: r.totalIrr,
        },
      });
      await tx.durableJob.upsert({
        where: { key: `refund-${id}` },
        create: { key: `refund-${id}`, kind: 'REFUND', reservationId: id },
        update: {},
      });
      await audit(tx, 'worker', 'SUPPLIER_REJECTED_REFUND_PENDING', id);
    });
    return;
  }
  await serializable(async (tx) => {
    const updated = await tx.reservation.updateMany({
      where: { id, status: 'CONFIRMING', paymentStatus: 'PAID', fulfilmentStatus: 'PENDING' },
      data: { status: 'CONFIRMED', fulfilmentStatus: 'ISSUED' },
    });
    if (!updated.count) return;
    await tx.document.create({
      data: {
        reservationId: id,
        supplierReference: confirmed.reference,
        kind: confirmed.kind,
        demo: confirmed.demo,
      },
    });
    await audit(tx, 'worker', 'DEMO_DOCUMENT_ISSUED', id, {
      supplierReference: confirmed.reference,
    });
    if (manualApproved)
      await tx.durableJob.updateMany({
        where: { reservationId: id, kind: 'ISSUE' },
        data: { status: 'DONE' },
      });
  });
}
export async function settleRefund(id: string) {
  const r = await db.reservation.findUnique({
    where: { id },
    include: { payment: true, document: true, refunds: true },
  });
  if (!r || r.paymentStatus === 'REFUNDED') return;
  assert(
    r.payment &&
      r.paymentStatus === 'REFUND_PENDING' &&
      r.refunds.some((f) => f.status === 'APPROVED'),
    409,
    'REFUND_STATE',
    'استرداد هنوز تأیید نشده است.'
  );
  if (r.document) {
    const cancelled = await demoSupplier.cancel({
      reference: r.document.supplierReference,
      idempotencyKey: `cancel-${id}`,
    });
    assert(
      cancelled.cancelled,
      503,
      'SUPPLIER_CANCELLATION_PENDING',
      'تأمین‌کننده هنوز لغو را تأیید نکرده است.'
    );
  }
  const result = await demoGateway.refund(r.payment.providerReference, r.totalIrr, `refund-${id}`);
  assert(result.settled, 503, 'REFUND_UNSETTLED', 'استرداد هنوز تسویه نشده است.');
  await serializable(async (tx) => {
    const updated = await tx.reservation.updateMany({
      where: { id, paymentStatus: 'REFUND_PENDING' },
      data: { paymentStatus: 'REFUNDED', status: 'CANCELLED' },
    });
    if (!updated.count) return;
    if (r.status === 'CANCELLATION_REQUESTED') await releaseInventory(tx, id);
    await tx.refund.updateMany({
      where: { reservationId: id, status: 'APPROVED' },
      data: { status: 'SETTLED_DEMO' },
    });
    await audit(tx, 'worker', 'REFUND_SETTLED_DEMO', id);
  });
}
