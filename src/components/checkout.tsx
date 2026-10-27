'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRound, ShieldCheck, ArrowLeft, LockKeyhole, Plus, Minus } from 'lucide-react';
import { passengerSchema } from '@/server/validation';
import { api, post, useApp } from './providers';
import { Button } from './ui/button';
import { type Line, type Offer, type Order, toman, fa, persianDate, productLabel } from './types';
const schema = z.object({
  passengers: z.array(passengerSchema).min(1).max(9),
  consent: z.boolean().refine(Boolean, 'شرایط رزرو را مطالعه و تأیید کنید.'),
});
const blank = { firstName: '', lastName: '', birthDate: '1990-01-01', documentNumber: '' };
export function Checkout() {
  const params = useSearchParams(),
    router = useRouter(),
    { user, loading: authLoading } = useApp();
  const [offers, setOffers] = useState<Offer[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [order, setOrder] = useState<Order | null>(null);
  const key = useRef<string>('');
  let items: Line[] = [];
  try {
    items = JSON.parse(params.get('items') ?? '[]');
    if (
      !Array.isArray(items) ||
      items.length > 6 ||
      items.length === 0 ||
      items.some((i) => !i.offerId || !i.quantity || !i.startDate)
    )
      throw new Error();
  } catch {
    items = [];
  }
  const itemsText = JSON.stringify(items);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      passengers: Array.from({ length: Math.min(items[0]?.quantity ?? 1, 9) }, () => ({
        ...blank,
      })),
      consent: false,
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'passengers' });
  useEffect(() => {
    const storageKey = `berjis-attempt:${itemsText}`;
    try {
      key.current = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, key.current);
    } catch {
      key.current = crypto.randomUUID();
    }
    const lines: Line[] = JSON.parse(itemsText);
    if (!lines.length) {
      setError('انتخاب معتبری وجود ندارد. از جستجو یک پیشنهاد انتخاب کنید.');
      setLoading(false);
      return;
    }
    Promise.all(lines.map((i) => api<Offer>(`offers/${encodeURIComponent(i.offerId)}`)))
      .then(setOffers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [itemsText]);
  const total = items.reduce(
    (sum, line, i) =>
      sum +
      (offers[i]?.priceIrr ?? 0) *
        line.quantity *
        (offers[i]?.product === 'HOTEL'
          ? Math.max(
              1,
              (new Date(line.endDate).getTime() - new Date(line.startDate).getTime()) / 86400000
            )
          : 1),
    0
  );
  const submit = handleSubmit(async (values) => {
    setError('');
    try {
      const held =
        order ??
        (await post<Order>(
          'orders',
          { items, passengers: values.passengers, expectedTotalIrr: total },
          { 'Idempotency-Key': key.current }
        ));
      setOrder(held);
      const payment = await post<{ id: string }>(`orders/${held.id}/payments`);
      try {
        sessionStorage.removeItem(`berjis-attempt:${itemsText}`);
      } catch {}
      router.push(`/payment/demo/${payment.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ارتباط');
    }
  });
  if (authLoading || loading)
    return (
      <div className="container page-pad">
        <div className="skeleton" style={{ height: 350 }} />
      </div>
    );
  if (!user)
    return (
      <div className="container page-pad">
        <div className="empty-state">
          <UserRound size={40} />
          <h1>برای رزرو وارد حساب شوید</h1>
          <p>انتخاب شما حفظ می‌شود و پس از ورود به همین مرحله برمی‌گردید.</p>
          <Button asChild>
            <Link href={`/login?next=${encodeURIComponent(`/checkout?${params}`)}`}>
              ورود یا ثبت‌نام <ArrowLeft size={17} />
            </Link>
          </Button>
        </div>
      </div>
    );
  if (!offers.length)
    return (
      <div className="container page-pad">
        <div className="empty-state">
          <h1>پیشنهادی انتخاب نشده است</h1>
          <p>{error}</p>
          <Link href="/search" className="btn btn-primary">
            جستجوی سفر
          </Link>
        </div>
      </div>
    );
  const hotel = offers[0].product === 'HOTEL';
  return (
    <div className="container page-pad">
      <div className="breadcrumb">
        <Link href="/">برجیس</Link>
        <span>/</span>تکمیل رزرو
      </div>
      <div className="checkout-title">
        <span className="eyebrow">چند قدم تا یک داستان تازه</span>
        <h1>اطلاعات مسافران و بررسی سفارش</h1>
      </div>
      <div className="checkout-steps">
        <span>
          <i>۱</i>انتخاب سفر
        </span>
        <span className="active">
          <i>۲</i>اطلاعات مسافران
        </span>
        <span>
          <i>۳</i>پرداخت آزمایشی
        </span>
        <span>
          <i>۴</i>تأیید و صدور
        </span>
      </div>
      <div className="checkout-layout">
        <form onSubmit={submit}>
          <div className="notice-box">
            این رزرو کاملاً آزمایشی است. مدرک و مشخصات واقعی وارد نکنید. برای همه سنین نرخ آزمایشی
            یکسان و یک واحد ظرفیت در نظر گرفته می‌شود.
          </div>
          {fields.map((field, i) => (
            <section className="panel" key={field.id}>
              <div className="passenger-heading">
                <h3>
                  <UserRound size={17} style={{ display: 'inline', marginLeft: 8 }} />
                  مسافر {fa(i + 1)}
                </h3>
                {hotel && fields.length > items[0].quantity && (
                  <button className="delete-button" type="button" onClick={() => remove(i)}>
                    حذف مسافر
                  </button>
                )}
              </div>
              <div className="form-grid">
                <label className="form-label">
                  نام مطابق مدرک
                  <input
                    disabled={!!order}
                    {...register(`passengers.${i}.firstName`)}
                    autoComplete="off"
                  />
                  {errors.passengers?.[i]?.firstName && (
                    <span className="form-error">نام باید حداقل دو حرف باشد.</span>
                  )}
                </label>
                <label className="form-label">
                  نام خانوادگی
                  <input
                    disabled={!!order}
                    {...register(`passengers.${i}.lastName`)}
                    autoComplete="off"
                  />
                  {errors.passengers?.[i]?.lastName && (
                    <span className="form-error">نام خانوادگی را کامل وارد کنید.</span>
                  )}
                </label>
                <label className="form-label">
                  تاریخ تولد (میلادی)
                  <input
                    disabled={!!order}
                    type="date"
                    {...register(`passengers.${i}.birthDate`)}
                    max={new Date().toISOString().slice(0, 10)}
                  />
                  {errors.passengers?.[i]?.birthDate && (
                    <span className="form-error">تاریخ تولد معتبر وارد کنید.</span>
                  )}
                </label>
                <label className="form-label">
                  شماره مدرک آزمایشی
                  <input
                    disabled={!!order}
                    dir="ltr"
                    placeholder="DEMO123456"
                    {...register(`passengers.${i}.documentNumber`)}
                    autoComplete="off"
                  />
                  {errors.passengers?.[i]?.documentNumber && (
                    <span className="form-error">۶ تا ۲۰ حرف یا رقم انگلیسی وارد کنید.</span>
                  )}
                </label>
              </div>
            </section>
          ))}
          {hotel && fields.length < Math.min(items[0].quantity * 2, 9) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ ...blank })}
              style={{ marginTop: 20 }}
            >
              <Plus size={17} />
              افزودن مهمان (تا دو نفر در هر اتاق)
            </Button>
          )}
          <label className="consent">
            <input type="checkbox" {...register('consent')} />
            <span>
              اطلاعات مسافران را بررسی کرده‌ام و{' '}
              <Link href="/terms" target="_blank">
                شرایط رزرو و کنسلی
              </Link>{' '}
              را می‌پذیرم. می‌دانم این خرید آزمایشی است و سند آن اعتبار سفر ندارد.
            </span>
          </label>
          {errors.consent && <p className="form-error">{errors.consent.message}</p>}
          {error && (
            <div className="inline-error" style={{ marginTop: 20 }} role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <span className="small muted">
              <LockKeyhole size={14} style={{ display: 'inline', marginLeft: 5 }} />
              مدارک با رمزگذاری در دیتابیس ذخیره می‌شوند.
            </span>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting
                ? 'در حال بررسی قیمت و ظرفیت…'
                : order
                  ? 'ادامه پرداخت رزرو ثبت‌شده'
                  : 'ثبت رزرو و ورود به پرداخت آزمایشی'}
              <ArrowLeft size={17} />
            </Button>
          </div>
          {order && (
            <Link
              href={`/orders/${order.id}`}
              className="text-link small"
              style={{ marginTop: 18 }}
            >
              مشاهده رزرو موقت ثبت‌شده
            </Link>
          )}
        </form>
        <aside className="booking-sidebar">
          <h3>خلاصه سفر شما</h3>
          {offers.map((offer, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--line)', paddingBlock: 18 }}>
              <span className="small muted">
                {productLabel[offer.product]} <span className="demo-mini">DEMO</span>
              </span>
              <h3 style={{ fontSize: 15, marginBlock: '12px 10px' }}>{offer.title}</h3>
              <p className="small muted">
                {offer.origin ? `${offer.origin} ← ` : ''}
                {offer.destination}
                <br />
                {persianDate(items[i].startDate, true)}
                {hotel ? ` تا ${persianDate(items[i].endDate, true)}` : ''}
                <br />
                {fa(items[i].quantity)} {hotel ? 'اتاق' : 'مسافر'}
              </p>
            </div>
          ))}
          <div className="summary-line">
            <span>خدمات و مالیات اضافه</span>
            <span>بدون هزینه پنهان</span>
          </div>
          <div className="summary-line total">
            <span>مبلغ نهایی</span>
            <strong>
              {toman(total)} <small>تومان</small>
            </strong>
          </div>
          <p className="notice">
            <ShieldCheck size={16} style={{ display: 'inline', marginLeft: 5 }} />
            قیمت در سرور محاسبه و ظرفیت به مدت ۱۵ دقیقه نگه داشته می‌شود. مبلغ ریالی درگاه:{' '}
            {fa(total)} ریال.
          </p>
        </aside>
      </div>
    </div>
  );
}
