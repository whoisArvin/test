'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Star, Check, Clock, ShieldCheck, Plane, ArrowLeft } from 'lucide-react';
import { useResource } from './providers';
import { type Offer, toman, fa, todayPlus, productLabel } from './types';
import { PersianDateInput } from './search-form';
import { Button } from './ui/button';
export function OfferDetails({ id }: { id: string }) {
  const { data: offer, error, loading, reload } = useResource<Offer>(`offers/${id}`);
  const router = useRouter();
  const [start, setStart] = useState(todayPlus(3)),
    [end, setEnd] = useState(todayPlus(6)),
    [qty, setQty] = useState(1);
  if (loading)
    return (
      <div className="container page-pad">
        <div className="skeleton" style={{ height: 350 }} />
      </div>
    );
  if (error || !offer)
    return (
      <div className="container page-pad">
        <div className="empty-state">
          <p>{error || 'پیشنهاد یافت نشد.'}</p>
          <Button onClick={reload}>تلاش دوباره</Button>
        </div>
      </div>
    );
  const nights =
    offer.product === 'HOTEL'
      ? Math.max(1, (new Date(end).getTime() - new Date(start).getTime()) / 86400000)
      : 1;
  const total = offer.priceIrr * qty * nights;
  const d = offer.details;
  const book = () =>
    router.push(
      `/checkout?items=${encodeURIComponent(JSON.stringify([{ offerId: id, startDate: start, endDate: offer.product === 'HOTEL' ? end : start, quantity: qty }]))}`
    );
  return (
    <div className="container page-pad">
      <div className="breadcrumb">
        <Link href="/">برجیس</Link>
        <span>/</span>
        <Link href={`/search?product=${offer.product}`}>{productLabel[offer.product]}</Link>
        <span>/</span>
        {offer.destination}
      </div>
      <div className="detail-header">
        <div>
          <div className="stars">
            {Array.from({ length: d.stars ?? 0 }, (_, i) => (
              <Star size={15} fill="currentColor" key={i} />
            ))}
          </div>
          <h1>{offer.title}</h1>
          <span className="location-text">
            <MapPin size={15} />
            {offer.destination} · {offer.subtitle}
          </span>
        </div>
        <span className="demo-tag">DEMO · آزمایشی</span>
      </div>
      <div className="detail-gallery">
        <div>
          <Image
            src={offer.image}
            fill
            priority
            sizes="(max-width:800px) 100vw,65vw"
            alt="تصویر الهام‌بخش سفر؛ تصویر واقعی محصول نیست"
          />
        </div>
        <div>
          <Image
            src="/images/travel-hero.jpg"
            fill
            sizes="35vw"
            alt="چشم‌انداز الهام‌بخش مدیترانه"
          />
        </div>
      </div>
      <div className="detail-layout">
        <section>
          <nav className="detail-tabs">
            <a href="#overview">معرفی</a>
            <a href="#services">
              {offer.product === 'HOTEL' ? 'اتاق و امکانات' : 'خدمات و جزئیات'}
            </a>
            <a href="#itinerary">{offer.product === 'HOTEL' ? 'موقعیت روی نقشه' : 'برنامه سفر'}</a>
            <a href="#rules">قوانین و شرایط</a>
          </nav>
          <div className="detail-text" id="overview">
            <h2>تجربه‌ای به سبک برجیس</h2>
            <p>
              {offer.subtitle}. این پیشنهاد برای آزمایش مسیر جستجو، رزرو و پرداخت طراحی شده است.
              قیمت، موجودی، امکانات و سند صادرشده صرفاً آزمایشی هستند. تصاویر الهام‌بخش‌اند و تصویری
              قراردادی از محصول محسوب نمی‌شوند.
            </p>
          </div>
          <div className="panel" id="services">
            <h2>{offer.product === 'HOTEL' ? 'اتاق دوتخته استاندارد' : 'جزئیات سفر'}</h2>
            {offer.product === 'FLIGHT' ? (
              <div className="form-grid">
                <p className="detail-text">
                  {offer.origin} ← {offer.destination}
                  <br />
                  {d.departure} — {d.arrival}
                  <br />
                  {d.airline} · {d.flightNumber}
                </p>
                <p className="detail-text">
                  {d.cabin} · {d.duration}
                  <br />
                  بار مجاز: {d.baggage}
                  <br />
                  پرواز مستقیم
                </p>
              </div>
            ) : (
              <>
                <div className="tag-row">
                  {(d.amenities ?? d.services ?? []).map((a) => (
                    <span key={a}>
                      <Check size={12} style={{ display: 'inline', marginLeft: 5 }} />
                      {a}
                    </span>
                  ))}
                </div>
                <p className="detail-text">
                  {offer.product === 'HOTEL'
                    ? `ظرفیت هر اتاق: ۲ نفر · ورود ${d.checkIn} · خروج ${d.checkOut}`
                    : `${d.duration} · سفر ${d.transport}`}
                </p>
                {d.manualConfirmation && (
                  <div className="notice-box">
                    این تور پس از پرداخت آزمایشی به بررسی و تأیید دستی کارشناس نیاز دارد.
                  </div>
                )}
              </>
            )}
          </div>
          <div className="panel" id="itinerary">
            <h2>{offer.product === 'HOTEL' ? 'موقعیت نمونه روی نقشه' : 'برنامه سفر'}</h2>
            {offer.product === 'HOTEL' ? (
              <>
                <p className="small muted">
                  مختصات نمایشی؛ برای سفر واقعی باید نشانی تأمین‌کننده تأیید شود.
                </p>
                <div className="map-panel">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lng}#map=15/${d.lat}/${d.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin size={30} />
                    {offer.destination} · مشاهده در OpenStreetMap
                    <ArrowLeft size={15} />
                  </a>
                </div>
              </>
            ) : (
              <div className="timeline">
                {(
                  d.itinerary ?? [
                    'بررسی اطلاعات مسافر و شرایط سفر',
                    'تأیید ظرفیت و پرداخت آزمایشی',
                    'صدور سند DEMO پس از تأیید تأمین‌کننده',
                  ]
                ).map((line, i) => (
                  <div key={i}>
                    <strong>
                      {offer.product === 'TOUR' ? `روز ${fa(i + 1)}` : `مرحله ${fa(i + 1)}`}
                    </strong>
                    <p style={{ marginTop: 10, color: '#7d8796' }}>{line}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel detail-text" id="rules">
            <h2>قوانین رزرو و کنسلی</h2>
            <p>{d.rules}</p>
            {d.documents && (
              <>
                <h3>مدارک موردنیاز</h3>
                <p>{d.documents}</p>
              </>
            )}
            <p>
              پرداخت به‌تنهایی به معنای صدور نیست. در صورت رد صدور، سفارش وارد مسیر استرداد می‌شود.
              مبلغ این نسخه به ریال ذخیره و به تومان نمایش داده می‌شود. رزرو موقت ۱۵ دقیقه اعتبار
              دارد.
            </p>
            <Link href="/terms" className="text-link">
              شرایط کامل استفاده <ArrowLeft size={16} />
            </Link>
          </div>
        </section>
        <aside className="booking-sidebar">
          <span className="small muted">
            {offer.product === 'HOTEL' ? 'قیمت هر اتاق، هر شب' : 'قیمت برای هر مسافر'}
          </span>
          <strong className="price">
            {toman(offer.priceIrr)} <small>تومان</small>
          </strong>
          <label className="form-label">
            {offer.product === 'HOTEL' ? 'تاریخ ورود' : 'تاریخ حرکت'}
            <PersianDateInput value={start} onChange={setStart} label="تاریخ حرکت" />
          </label>
          {offer.product === 'HOTEL' && (
            <label className="form-label">
              تاریخ خروج
              <PersianDateInput value={end} onChange={setEnd} min={start} label="تاریخ خروج" />
            </label>
          )}
          <label className="form-label">
            {offer.product === 'HOTEL' ? 'تعداد اتاق' : 'تعداد مسافران'}
            <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {fa(n)}
                </option>
              ))}
            </select>
          </label>
          <div className="summary-line total">
            <span>مبلغ نهایی</span>
            <strong>
              {toman(total)} <small>تومان</small>
            </strong>
          </div>
          <Button onClick={book}>
            بررسی و رزرو آزمایشی <ArrowLeft size={16} />
          </Button>
          <p className="notice">
            <ShieldCheck size={14} style={{ display: 'inline', marginLeft: 5 }} />
            ظرفیت و قیمت پیش از ایجاد رزرو دوباره بررسی می‌شوند. هیچ مبلغ واقعی از شما دریافت
            نمی‌شود.
          </p>
        </aside>
      </div>
    </div>
  );
}
