'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CreditCard, ShieldCheck, Check, X, AlertTriangle } from 'lucide-react';
import { post, useResource } from './providers';
import { Button } from './ui/button';
import { toman, fa, type Order } from './types';
interface Payment {
  id: string;
  amountIrr: number;
  reservation: { id: string; reference: string; paymentStatus: string };
  gateway: { status: string };
}
export function PaymentDemo({ id }: { id: string }) {
  const { data, error, loading } = useResource<Payment>(`payments/${id}`),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(''),
    router = useRouter();
  async function simulate(outcome: string) {
    setBusy(true);
    setFailure('');
    try {
      const r = await post<Order>(`payments/${id}/simulate`, { outcome });
      router.push(`/orders/${r.id}`);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'خطای ارتباط');
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="payment-shell panel">
        <div className="skeleton" style={{ height: 350 }} />
      </div>
    );
  if (error || !data)
    return (
      <div className="payment-shell empty-state">
        <p>{error}</p>
        <Link href="/login" className="btn btn-primary">
          ورود به حساب
        </Link>
      </div>
    );
  return (
    <div className="payment-shell">
      <div className="panel">
        <span className="gateway-icon">
          <CreditCard size={31} />
        </span>
        <span className="eyebrow">درگاه آزمایشی برجیس · DEMO</span>
        <h1>شبیه‌ساز پرداخت</h1>
        <p className="small muted" style={{ marginTop: 13 }}>
          هیچ کارت بانکی و هیچ مبلغ واقعی در این محیط استفاده نمی‌شود. نتیجه دلخواه را برای آزمایش
          انتخاب کنید.
        </p>
        <div className="summary-line">
          <span>شناسه سفارش</span>
          <strong dir="ltr">{data.reservation.reference}</strong>
        </div>
        <div className="summary-line total">
          <span>مبلغ آزمایشی</span>
          <strong>
            {toman(data.amountIrr)} <small>تومان</small>
          </strong>
        </div>
        <p className="small muted">
          معادل {fa(data.amountIrr)} ریال · اعتبارسنجی مبلغ و سفارش در سرور
        </p>
        <div className="notice-box">
          <ShieldCheck size={17} style={{ display: 'inline', marginLeft: 6 }} />
          پرداخت موفق به‌تنهایی تأیید رزرو نیست. نتیجه صدور را در صفحه سفارش مشاهده کنید.
        </div>
        {data.gateway.status === 'PENDING' ? (
          <div className="payment-outcomes">
            <Button disabled={busy} onClick={() => simulate('SUCCESS')}>
              <Check size={17} />
              پرداخت موفق آزمایشی
            </Button>
            <Button disabled={busy} onClick={() => simulate('ISSUE_FAILURE')} variant="outline">
              <AlertTriangle size={17} />
              پرداخت موفق، شکست صدور
            </Button>
            <Button disabled={busy} onClick={() => simulate('FAILED')} variant="outline">
              <X size={17} />
              پرداخت ناموفق
            </Button>
            <Button disabled={busy} onClick={() => simulate('CANCELLED')} variant="ghost">
              انصراف از پرداخت
            </Button>
          </div>
        ) : (
          <Button asChild style={{ marginTop: 25 }}>
            <Link href={`/orders/${data.reservation.id}`}>مشاهده نتیجه سفارش</Link>
          </Button>
        )}
        {failure && (
          <div className="inline-error" role="alert" style={{ marginTop: 20 }}>
            {failure}
          </div>
        )}
        {busy && (
          <p role="status" className="small muted" style={{ marginTop: 15 }}>
            در حال تأیید سمت سرور…
          </p>
        )}
      </div>
    </div>
  );
}
