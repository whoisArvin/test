'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useResource, post, useApp } from './providers';
import { type Order, toman, fa, persianDate, statusLabel, productLabel } from './types';
import { Button } from './ui/button';
export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`status-badge ${['CONFIRMED', 'PAID', 'ISSUED', 'REFUNDED', 'SETTLED_DEMO'].includes(value) ? 'success' : ['FAILED', 'EXPIRED', 'CANCELLED'].includes(value) ? 'failed' : ''}`}
    >
      {statusLabel[value] ?? value}
    </span>
  );
}
const events: Record<string, string> = {
  RESERVATION_HELD: 'ظرفیت به‌صورت موقت نگه داشته شد',
  PAYMENT_STARTED: 'تراکنش آزمایشی ایجاد شد',
  PAYMENT_VERIFIED: 'پرداخت DEMO در سرور تأیید شد',
  DEMO_DOCUMENT_ISSUED: 'تأمین‌کننده آزمایشی صدور را تأیید کرد',
  PAYMENT_FAILED: 'پرداخت ناموفق یا منصرف‌شده',
  SUPPLIER_REJECTED_REFUND_PENDING: 'صدور ناموفق؛ سفارش وارد استرداد شد',
  REFUND_SETTLED_DEMO: 'استرداد آزمایشی تسویه شد',
  CANCELLATION_REQUESTED: 'درخواست کنسلی ثبت شد',
  HOLD_EXPIRED: 'مهلت نگهداری ظرفیت پایان یافت',
  UNPAID_CANCELLED: 'رزرو پرداخت‌نشده لغو شد',
  LATE_PAYMENT_REFUND_REQUIRED: 'پرداخت دیرهنگام؛ نیاز به استرداد',
  REFUND_APPROVED: 'کارشناس استرداد را تأیید کرد',
  MANUAL_CONFIRMATION_REVIEWED: 'بررسی دستی کارشناس ثبت شد',
};
export function OrderDetails({ id }: { id: string }) {
  const { data: order, error, loading, reload } = useResource<Order>(`orders/${id}`),
    { toast } = useApp(),
    router = useRouter(),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [showCancel, setShowCancel] = useState(false),
    [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!order) return;
    const t = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.floor((new Date(order.expiresAt).getTime() - Date.now()) / 1000)
      );
      setRemaining(`${fa(Math.floor(seconds / 60))}:${fa(seconds % 60).padStart(2, '۰')}`);
    }, 1000);
    return () => clearInterval(t);
  }, [order]);
  const shouldPoll =
    order?.status === 'CONFIRMING' ||
    order?.paymentStatus === 'REFUND_PENDING' ||
    order?.status === 'AWAITING_PAYMENT';
  useEffect(() => {
    if (!shouldPoll) return;
    const t = setInterval(() => void reload(), 4000);
    return () => clearInterval(t);
  }, [shouldPoll, reload]);
  async function pay() {
    setBusy(true);
    try {
      const p = await post<{ id: string }>(`orders/${id}/payments`);
      router.push(`/payment/demo/${p.id}`);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      await post(`orders/${id}/cancel`, { reason });
      setShowCancel(false);
      toast('درخواست شما ثبت شد.');
      await reload();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  if (loading && !order)
    return (
      <div className="container page-pad">
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  if (error && !order)
    return (
      <div className="container page-pad">
        <div className="empty-state">
          <p>{error}</p>
          <Link className="btn btn-primary" href="/account">
            بازگشت به حساب
          </Link>
        </div>
      </div>
    );
  if (!order) return null;
  const confirmed = order.status === 'CONFIRMED' && order.fulfilmentStatus === 'ISSUED';
  return (
    <div className="container page-pad">
      <div className="breadcrumb">
        <Link href="/account">حساب کاربری</Link>
        <span>/</span>
        <span>{order.reference}</span>
      </div>
      <div className="detail-header">
        <div>
          <span className="eyebrow">پیگیری شفاف، در تمام مراحل</span>
          <h1>
            جزئیات سفارش{' '}
            <span dir="ltr" style={{ display: 'inline-block', fontSize: 22 }}>
              {order.reference}
            </span>
          </h1>
          <p className="small muted">
            ثبت در {persianDate(order.createdAt, true)} · {productLabel[order.product]}
          </p>
        </div>
        <span className="demo-tag">DEMO</span>
      </div>
      <div className="notice-box" style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
        {confirmed ? (
          <CheckCircle2 size={21} />
        ) : order.status === 'FAILED' ? (
          <AlertTriangle size={21} />
        ) : (
          <Clock size={21} />
        )}
        <div>
          <strong>{confirmed ? 'سند آزمایشی صادر شده است' : statusLabel[order.status]}</strong>
          <p>
            {confirmed
              ? 'این سند صرفاً برای آزمایش است و برای سفر یا اقامت اعتبار ندارد.'
              : order.paymentStatus === 'REFUND_PENDING'
                ? 'مبلغ آزمایشی پرداخت شده اما رزرو قطعی نشده است؛ فرایند استرداد در حال پیگیری است.'
                : order.status === 'CONFIRMING'
                  ? 'پرداخت تأیید شده است. منتظر نتیجه تأمین‌کننده یا بررسی دستی کارشناس بمانید.'
                  : 'وضعیت پرداخت، رزرو و صدور را جداگانه بررسی کنید.'}
          </p>
        </div>
      </div>
      <div className="order-state-grid">
        <div>
          <span>وضعیت رزرو</span>
          <StatusBadge value={order.status} />
        </div>
        <div>
          <span>وضعیت پرداخت</span>
          <StatusBadge value={order.paymentStatus} />
        </div>
        <div>
          <span>وضعیت صدور</span>
          <StatusBadge value={order.fulfilmentStatus} />
        </div>
      </div>
      <div className="checkout-layout">
        <section>
          <div className="panel">
            <h2>برنامه سفر</h2>
            {order.items.map((item) => (
              <div key={item.id} className="summary-line">
                <div>
                  <strong>{item.offer.title}</strong>
                  <p className="small muted">
                    {item.offer.origin ? `${item.offer.origin} ← ` : ''}
                    {item.offer.destination} · {persianDate(item.startDate, true)}
                    {order.product === 'HOTEL' ? ` تا ${persianDate(item.endDate, true)}` : ''}
                  </p>
                </div>
                <span>
                  {fa(item.quantity)} {order.product === 'HOTEL' ? 'اتاق' : 'مسافر'}
                </span>
              </div>
            ))}
            <h3 style={{ marginTop: 28 }}>مسافران</h3>
            {order.passengers.map((p, i) => (
              <p key={i} className="detail-text">
                {fa(i + 1)}. {p.firstName} {p.lastName} · {persianDate(p.birthDate, true)}
              </p>
            ))}
          </div>
          <div className="panel">
            <h2>تاریخچه سفارش</h2>
            <div className="timeline">
              {order.audits.map((a) => (
                <div key={a.id}>
                  <strong>{events[a.action] ?? 'تغییر وضعیت سفارش'}</strong>
                  <small>
                    {persianDate(a.createdAt, true)} ·{' '}
                    {new Date(a.createdAt).toLocaleTimeString('fa-IR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={reload}>
              <RefreshCw size={15} />
              به‌روزرسانی وضعیت
            </Button>
          </div>
          {order.refunds.length > 0 && (
            <div className="panel">
              <h2>پیگیری استرداد</h2>
              {order.refunds.map((r) => (
                <div className="ticket-card" key={r.id}>
                  <StatusBadge value={r.status} />
                  <p style={{ marginTop: 12 }}>{r.reason}</p>
                  <p>{toman(r.amountIrr)} تومان · صرفاً آزمایشی</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <aside className="booking-sidebar">
          <h3>خلاصه پرداخت</h3>
          <div className="summary-line total">
            <span>مبلغ نهایی</span>
            <strong>
              {toman(order.totalIrr)} <small>تومان</small>
            </strong>
          </div>
          {order.status === 'AWAITING_PAYMENT' && (
            <>
              <div className="notice-box">
                مهلت رزرو موقت: {remaining || '۱۵:۰۰'}
                <br />
                ظرفیت پس از پایان مهلت آزاد می‌شود.
              </div>
              <Button onClick={pay} disabled={busy}>
                ادامه پرداخت آزمایشی <ArrowLeft size={16} />
              </Button>
            </>
          )}
          {confirmed && order.document && (
            <>
              <div className="notice-box">
                شماره تأیید تأمین‌کننده آزمایشی:
                <br />
                <b dir="ltr" style={{ overflowWrap: 'anywhere' }}>
                  {order.document.supplierReference}
                </b>
              </div>
              <Button asChild>
                <a href={`/api/v1/orders/${id}/receipt`}>
                  <Download size={17} />
                  دریافت سند DEMO
                </a>
              </Button>
            </>
          )}
          {['AWAITING_PAYMENT', 'CONFIRMED'].includes(order.status) && (
            <Button variant="outline" onClick={() => setShowCancel(!showCancel)}>
              {order.status === 'AWAITING_PAYMENT' ? 'لغو رزرو موقت' : 'درخواست کنسلی و استرداد'}
            </Button>
          )}
          {showCancel && (
            <div style={{ marginTop: 18 }}>
              <label className="form-label">
                دلیل درخواست
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  minLength={5}
                  maxLength={1000}
                />
              </label>
              <Button variant="danger" disabled={busy || reason.trim().length < 5} onClick={cancel}>
                ثبت درخواست
              </Button>
            </div>
          )}
          <p className="notice">
            پرداخت، صدور و استرداد این سفارش آزمایشی هستند. هیچ مبلغ واقعی جابه‌جا نمی‌شود.
          </p>
        </aside>
      </div>
    </div>
  );
}
