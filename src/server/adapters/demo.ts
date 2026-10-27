import type { TravelSupplier, PaymentGateway } from './contracts';
import { demoOnly } from '../config';
import { db } from '../db';
import { assert } from '../errors';
export const demoSupplier: TravelSupplier = {
  id: 'demo-travel',
  mode: 'DEMO',
  async confirm({ reservationId, product, failureScenario }) {
    demoOnly();
    if (failureScenario === 'ISSUE_FAILURE') throw new Error('DEMO_SUPPLIER_REJECTED');
    return {
      reference: `DEMO-${reservationId}`,
      kind: product === 'FLIGHT' ? 'TICKET' : product === 'HOTEL' ? 'VOUCHER' : 'TOUR_CONFIRMATION',
      demo: true,
    };
  },
  async cancel() {
    demoOnly();
    return { cancelled: true };
  },
};
export const demoGateway: PaymentGateway = {
  mode: 'DEMO',
  async verify(reference) {
    demoOnly();
    const payment = await db.payment.findUnique({
      where: { providerReference: reference },
      include: { gateway: true },
    });
    assert(payment?.gateway, 404, 'PROVIDER_NOT_FOUND', 'تراکنش در سرویس آزمایشی یافت نشد.');
    assert(
      payment.gateway.currency === 'IRR',
      409,
      'CURRENCY_MISMATCH',
      'واحد پول تراکنش مطابقت ندارد.'
    );
    assert(
      ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(payment.gateway.status),
      503,
      'UNKNOWN_PROVIDER_STATUS',
      'وضعیت درگاه قابل تأیید نیست.'
    );
    return {
      reference,
      status: payment.gateway.status as
        'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED',
      orderId: payment.gateway.orderId,
      amountIrr: payment.gateway.amountIrr,
      currency: 'IRR',
      paid: payment.gateway.status === 'SUCCEEDED',
      failureScenario: payment.gateway.failureScenario,
    };
  },
  async refund(reference, amountIrr) {
    demoOnly();
    const p = await db.payment.findUnique({
      where: { providerReference: reference },
      include: { gateway: true },
    });
    assert(
      p?.gateway &&
        ['SUCCEEDED', 'REFUNDED'].includes(p.gateway.status) &&
        p.amountIrr === amountIrr,
      409,
      'REFUND_MISMATCH',
      'تراکنش قابل استرداد نیست.'
    );
    await db.demoGatewayTransaction.update({
      where: { paymentId: p.id },
      data: { status: 'REFUNDED' },
    });
    return { settled: true, demo: true };
  },
};
