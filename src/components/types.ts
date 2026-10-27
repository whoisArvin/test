export interface Details {
  airline?: string;
  flightNumber?: string;
  departure?: string;
  arrival?: string;
  duration?: string;
  stops?: number;
  baggage?: string;
  cabin?: string;
  fromCode?: string;
  toCode?: string;
  international?: boolean;
  rules?: string;
  stars?: number;
  amenities?: string[];
  lat?: number;
  lng?: number;
  roomType?: string;
  checkIn?: string;
  checkOut?: string;
  maxGuestsPerRoom?: number;
  transport?: string;
  manualConfirmation?: boolean;
  services?: string[];
  itinerary?: string[];
  documents?: string;
}
export interface Offer {
  id: string;
  product: 'FLIGHT' | 'HOTEL' | 'TOUR';
  title: string;
  subtitle: string;
  origin?: string;
  destination: string;
  priceIrr: number;
  image: string;
  details: Details;
  available?: number;
  startDate?: string;
  endDate?: string;
  totalIrr?: number;
  published?: boolean;
  inventory?: { date: string; total: number; available: number }[];
}
export interface Article {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  image: string;
  published?: boolean;
}
export interface Line {
  offerId: string;
  startDate: string;
  endDate: string;
  quantity: number;
}
export interface Passenger {
  firstName: string;
  lastName: string;
  birthDate: string;
  documentNumber: string;
}
export interface Order {
  id: string;
  reference: string;
  product: string;
  totalIrr: number;
  status: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  expiresAt: string;
  createdAt: string;
  items: {
    id: string;
    offerId: string;
    startDate: string;
    endDate: string;
    quantity: number;
    unitIrr: number;
    offer: Offer;
  }[];
  passengers: Omit<Passenger, 'documentNumber'>[];
  payment?: { id: string };
  document?: { supplierReference: string; kind: string; issuedAt: string };
  refunds: { id: string; status: string; reason: string; amountIrr: number }[];
  audits: { id: string; action: string; createdAt: string }[];
}
export const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
export const toman = (irr: number) => fa(irr / 10);
export const persianDate = (date: string | Date, full = false) =>
  new Intl.DateTimeFormat('fa-IR', {
    day: 'numeric',
    month: full ? 'long' : 'short',
    year: full ? 'numeric' : undefined,
    timeZone: 'Asia/Tehran',
  }).format(new Date(date));
export const todayPlus = (days = 3) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export const productLabel: Record<string, string> = { FLIGHT: 'پرواز', HOTEL: 'هتل', TOUR: 'تور' };
export const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: 'در انتظار پرداخت',
  CONFIRMING: 'در انتظار تأیید تأمین‌کننده',
  CONFIRMED: 'تأییدشده آزمایشی',
  EXPIRED: 'مهلت رزرو تمام شده',
  CANCELLED: 'لغوشده',
  CANCELLATION_REQUESTED: 'درخواست کنسلی',
  FAILED: 'ناموفق',
  UNPAID: 'پرداخت‌نشده',
  PROCESSING: 'در حال پرداخت',
  PAID: 'پرداخت آزمایشی تأیید شد',
  REFUND_PENDING: 'در انتظار استرداد',
  REFUNDED: 'استرداد آزمایشی انجام شد',
  NOT_ISSUED: 'صادرنشده',
  PENDING: 'در حال بررسی',
  ISSUED: 'صادرشده آزمایشی',
  REQUESTED: 'درخواست ثبت شد',
  APPROVED: 'تأییدشده',
  SETTLED_DEMO: 'تسویه آزمایشی',
};
