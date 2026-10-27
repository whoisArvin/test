import { db } from '../../src/server/db';
import { serializable } from '../../src/server/transaction';
import { releaseInventory } from '../../src/server/services/reservations';
/** Removes only explicitly recorded synthetic fixture IDs; never clears an application database. */
export async function cleanupFixtures(userIds: string[], offerIds: string[] = []) {
  if (process.env.PROVIDER_MODE !== 'DEMO')
    throw new Error('E2E fixture cleanup is only allowed in DEMO.');
  if (!userIds.length && !offerIds.length) return;
  await serializable(async (tx) => {
    const reservations = await tx.reservation.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, status: true },
    });
    const ids = reservations.map((r) => r.id);
    for (const r of reservations)
      if (
        ['AWAITING_PAYMENT', 'CONFIRMING', 'CONFIRMED', 'CANCELLATION_REQUESTED'].includes(r.status)
      )
        await releaseInventory(tx, r.id);
    await tx.durableJob.deleteMany({ where: { reservationId: { in: ids } } });
    await tx.paymentEvent.deleteMany({ where: { payment: { reservationId: { in: ids } } } });
    await tx.demoGatewayTransaction.deleteMany({
      where: { payment: { reservationId: { in: ids } } },
    });
    await tx.payment.deleteMany({ where: { reservationId: { in: ids } } });
    await tx.document.deleteMany({ where: { reservationId: { in: ids } } });
    await tx.refund.deleteMany({ where: { reservationId: { in: ids } } });
    await tx.passenger.deleteMany({ where: { reservationId: { in: ids } } });
    await tx.bookingItem.deleteMany({ where: { reservationId: { in: ids } } });
    await tx.auditLog.deleteMany({
      where: { OR: [{ reservationId: { in: ids } }, { actorId: { in: userIds } }] },
    });
    await tx.reservation.deleteMany({ where: { id: { in: ids } } });
    await tx.supportTicket.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    await tx.inventory.deleteMany({ where: { offerId: { in: offerIds } } });
    await tx.offer.deleteMany({ where: { id: { in: offerIds } } });
  });
}
