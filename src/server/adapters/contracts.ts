export interface Money {
  amountIrr: number;
  currency: 'IRR';
}
export interface SupplierConfirmation {
  reference: string;
  kind: 'TICKET' | 'VOUCHER' | 'TOUR_CONFIRMATION';
  demo: boolean;
}
export interface TravelSupplier {
  readonly id: string;
  readonly mode: 'DEMO' | 'LIVE';
  confirm(input: {
    reservationId: string;
    product: 'FLIGHT' | 'HOTEL' | 'TOUR';
    failureScenario?: string;
  }): Promise<SupplierConfirmation>;
  cancel(input: { reference: string; idempotencyKey: string }): Promise<{ cancelled: boolean }>;
}
export interface VerifiedPayment extends Money {
  orderId: string;
  paid: boolean;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  reference: string;
  failureScenario: string;
}
export interface PaymentGateway {
  readonly mode: 'DEMO' | 'LIVE';
  verify(providerReference: string): Promise<VerifiedPayment>;
  refund(
    providerReference: string,
    amountIrr: number,
    idempotencyKey: string
  ): Promise<{ settled: boolean; demo: boolean }>;
}
