'use client';
import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Plane,
  ArrowLeft,
  SlidersHorizontal,
  Briefcase,
  Clock,
  Star,
  MapPin,
  Check,
  ChevronDown,
  ArrowUpLeft,
  X,
  Route,
} from 'lucide-react';
import { SearchForm, type Leg } from './search-form';
import { useResource } from './providers';
import { type Offer, type Line, toman, fa, persianDate, todayPlus, productLabel } from './types';
import { Button } from './ui/button';
export function SearchResults() {
  const params = useSearchParams(),
    router = useRouter();
  const product = ['FLIGHT', 'HOTEL', 'TOUR'].includes(params.get('product') ?? '')
    ? (params.get('product') as Offer['product'])
    : 'FLIGHT';
  const [sort, setSort] = useState('price'),
    [airline, setAirline] = useState(''),
    [max, setMax] = useState(100_000_000),
    [time, setTime] = useState(''),
    [stars, setStars] = useState(''),
    [amenity, setAmenity] = useState(''),
    [filters, setFilters] = useState(false);
  const legIndex = Number(params.get('leg') ?? 0);
  let legs: Leg[] = [];
  let selected: Line[] = [];
  try {
    legs = JSON.parse(params.get('legs') ?? '[]');
    selected = JSON.parse(params.get('selected') ?? '[]');
    if (!Array.isArray(legs) || !Array.isArray(selected)) throw new Error();
  } catch {
    legs = [];
    selected = [];
  }
  const leg = legs[legIndex];
  const quantity = Number(params.get('quantity') ?? 1),
    start = leg?.date ?? params.get('startDate') ?? todayPlus(3),
    end = product === 'HOTEL' ? (params.get('endDate') ?? todayPlus(6)) : start,
    origin = leg?.origin ?? params.get('origin') ?? 'تهران',
    destination = leg?.destination ?? params.get('destination') ?? '';
  const query = new URLSearchParams({
    product,
    startDate: start,
    endDate: end,
    quantity: String(quantity),
    ...(destination ? { destination } : {}),
    ...(product === 'FLIGHT'
      ? { origin, ...(params.get('flightType') ? { flightType: params.get('flightType')! } : {}) }
      : {}),
  });
  const { data, error, loading, reload } = useResource<{ offers: Offer[] }>(`search?${query}`);
  const offers = useMemo(() => {
    const list = (data?.offers ?? []).filter(
      (o) =>
        o.priceIrr / 10 <= max &&
        (!airline || o.title === airline) &&
        (!stars || o.details.stars === Number(stars)) &&
        (!amenity || o.details.amenities?.includes(amenity)) &&
        (!time ||
          (time === 'morning'
            ? Number(o.details.departure?.slice(0, 2)) < 12
            : Number(o.details.departure?.slice(0, 2)) >= 12))
    );
    return [...list].sort((a, b) =>
      sort === 'price-desc'
        ? b.priceIrr - a.priceIrr
        : sort === 'time'
          ? (a.details.departure ?? '').localeCompare(b.details.departure ?? '')
          : a.priceIrr - b.priceIrr
    );
  }, [data, max, airline, sort, time, stars, amenity]);
  function choose(offer: Offer) {
    const next = [...selected, { offerId: offer.id, startDate: start, endDate: end, quantity }];
    if (product === 'FLIGHT' && legIndex + 1 < legs.length) {
      const q = new URLSearchParams(params.toString());
      q.set('leg', String(legIndex + 1));
      q.set('selected', JSON.stringify(next));
      router.push(`/search?${q}`);
    } else router.push(`/checkout?items=${encodeURIComponent(JSON.stringify(next))}`);
  }
  return (
    <div className="results-page">
      <div className="search-strip">
        <div className="container">
          <SearchForm key={product} initialProduct={product} compact />
        </div>
      </div>
      <div className="container page-pad">
        <div className="breadcrumb">
          <Link href="/">برجیس</Link>
          <span>/</span>
          <span>جستجوی {productLabel[product]}</span>
        </div>
        <div className="results-title">
          <div>
            <span className="eyebrow">فصل بعدی داستان شما</span>
            <h1>
              {product === 'FLIGHT'
                ? `${origin} به ${destination || 'مقصد شما'}`
                : product === 'HOTEL'
                  ? `اقامت در ${destination || 'مقصد دلخواه'}`
                  : 'تورهای منتخب برجیس'}
            </h1>
            <p>
              {persianDate(start, true)} {product === 'HOTEL' ? `تا ${persianDate(end, true)}` : ''}{' '}
              · {fa(quantity)} {product === 'HOTEL' ? 'اتاق' : 'مسافر'}{' '}
              <span className="demo-tag">DEMO</span>
            </p>
            {legs.length > 1 && (
              <div className="itinerary-steps">
                {legs.map((l, i) => (
                  <span className={i === legIndex ? 'active' : ''} key={i}>
                    {i < legIndex ? <Check size={14} /> : <Route size={14} />} {l.origin} ←{' '}
                    {l.destination}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button className="filter-toggle btn btn-outline" onClick={() => setFilters(!filters)}>
            <SlidersHorizontal size={18} />
            فیلترها
          </button>
        </div>
        <div className="results-layout">
          <aside className={`filters-panel ${filters ? 'show' : ''}`}>
            <div className="filter-heading">
              <h3>فیلتر جستجو</h3>
              <button
                onClick={() => {
                  setAirline('');
                  setStars('');
                  setAmenity('');
                  setTime('');
                  setMax(100_000_000);
                }}
              >
                حذف فیلترها
              </button>
            </div>
            <div className="filter-group">
              <h4>بازه قیمت، تومان</h4>
              <input
                type="range"
                min="1000000"
                max="100000000"
                step="1000000"
                value={max}
                onChange={(e) => setMax(Number(e.target.value))}
                aria-label="حداکثر قیمت"
              />
              <div className="range-labels">
                <span>تا {fa(max)}</span>
              </div>
            </div>
            {product === 'FLIGHT' ? (
              <>
                <div className="filter-group">
                  <h4>شرکت هواپیمایی</h4>
                  {['', 'ماهان', 'ایران‌ایر', 'کیش‌ایر'].map((a) => (
                    <label className="check-label" key={a}>
                      <input
                        type="radio"
                        name="airline"
                        checked={airline === a}
                        onChange={() => setAirline(a)}
                      />
                      {a || 'همه ایرلاین‌ها'}
                    </label>
                  ))}
                </div>
                <div className="filter-group">
                  <h4>زمان پرواز</h4>
                  <select
                    aria-label="فیلتر ساعت"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  >
                    <option value="">تمام روز</option>
                    <option value="morning">صبح، پیش از ۱۲</option>
                    <option value="afternoon">بعدازظهر و شب</option>
                  </select>
                </div>
              </>
            ) : product === 'HOTEL' ? (
              <>
                <div className="filter-group">
                  <h4>درجه هتل</h4>
                  <select
                    value={stars}
                    onChange={(e) => setStars(e.target.value)}
                    aria-label="درجه هتل"
                  >
                    <option value="">همه ستاره‌ها</option>
                    {[3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {fa(n)} ستاره
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <h4>امکانات</h4>
                  <select
                    value={amenity}
                    onChange={(e) => setAmenity(e.target.value)}
                    aria-label="امکانات هتل"
                  >
                    <option value="">همه امکانات</option>
                    {['استخر', 'صبحانه', 'اسپا', 'پارکینگ'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="filter-group">
                <p className="small muted">
                  تورهای نیازمند تأیید دستی، پس از پرداخت آزمایشی در انتظار بررسی کارشناس باقی
                  می‌مانند.
                </p>
              </div>
            )}
            <div className="filter-help">
              <Plane size={24} />
              <h4>انتخاب آگاهانه، سفر آسوده</h4>
              <p>قوانین و مبلغ نهایی را پیش از رزرو مطالعه کنید.</p>
              <Link href="/faq">
                پرسش‌های متداول <ArrowLeft size={14} />
              </Link>
            </div>
          </aside>
          <section>
            <div className="results-sort">
              <span>{loading ? 'در حال جستجو…' : `${fa(offers.length)} پیشنهاد آزمایشی`}</span>
              <label>
                مرتب‌سازی
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="مرتب‌سازی"
                >
                  <option value="price">کمترین قیمت</option>
                  <option value="price-desc">بیشترین قیمت</option>
                  {product === 'FLIGHT' && <option value="time">زودترین پرواز</option>}
                </select>
              </label>
            </div>
            {loading ? (
              <div className="result-list">
                {[1, 2, 3].map((n) => (
                  <div className="skeleton" style={{ height: 190 }} key={n} />
                ))}
              </div>
            ) : error ? (
              <div className="empty-state">
                <p>{error}</p>
                <Button onClick={reload}>تلاش دوباره</Button>
              </div>
            ) : offers.length === 0 ? (
              <div className="empty-state">
                <SearchEmpty />
                <h2>هنوز پیشنهادی برای این جستجو نداریم</h2>
                <p>
                  تاریخ، مقصد یا فیلترها را تغییر دهید. موجودی آزمایشی برای ۶۰ روز آینده تعریف شده
                  است.
                </p>
              </div>
            ) : (
              <div className="result-list">
                {offers.map((offer) =>
                  product === 'FLIGHT' ? (
                    <div className="flight-result" key={offer.id}>
                      <div className="flight-main">
                        <div className="airline-logo">
                          <Plane size={25} />
                        </div>
                        <div className="airline-title">
                          <h3>{offer.title}</h3>
                          <span className="small muted">
                            {offer.details.cabin} · {offer.details.flightNumber}
                          </span>
                        </div>
                        <div className="flight-time">
                          <strong>{offer.details.departure}</strong>
                          <small>{offer.origin}</small>
                          <span>{offer.details.fromCode}</span>
                        </div>
                        <div className="flight-path">
                          <small>{offer.details.duration}</small>
                          <div>
                            <i />
                            <span />
                            <Plane size={16} />
                          </div>
                          <small>بدون توقف</small>
                        </div>
                        <div className="flight-time">
                          <strong>{offer.details.arrival}</strong>
                          <small>{offer.destination}</small>
                          <span>{offer.details.toCode}</span>
                        </div>
                      </div>
                      <div className="flight-bottom">
                        <span>
                          <Briefcase size={15} />
                          {offer.details.baggage} بار مجاز
                        </span>
                        <details>
                          <summary>
                            جزئیات و قوانین <ChevronDown size={14} />
                          </summary>
                          <p>{offer.details.rules}</p>
                          <Link href={`/offers/${offer.id}`}>مشاهده جزئیات کامل</Link>
                        </details>
                        <span className="demo-mini">DEMO</span>
                      </div>
                      <div className="flight-price">
                        <small>مجموع {fa(quantity)} مسافر</small>
                        <strong>
                          {toman(offer.totalIrr ?? offer.priceIrr)} <small>تومان</small>
                        </strong>
                        <Button onClick={() => choose(offer)}>
                          انتخاب پرواز <ArrowLeft size={15} />
                        </Button>
                        <small>{fa(offer.available ?? 0)} صندلی باقی‌مانده</small>
                      </div>
                    </div>
                  ) : (
                    <div className="listing-result" key={offer.id}>
                      <Link className="listing-image" href={`/offers/${offer.id}`}>
                        <Image src={offer.image} fill sizes="260px" alt="تصویر الهام‌بخش مقصد" />
                        <span className="demo-mini">DEMO</span>
                      </Link>
                      <div className="listing-body">
                        {product === 'HOTEL' && (
                          <div className="stars">
                            {Array.from({ length: offer.details.stars ?? 0 }, (_, i) => (
                              <Star key={i} size={13} fill="currentColor" />
                            ))}
                          </div>
                        )}
                        <Link href={`/offers/${offer.id}`}>
                          <h3>{offer.title}</h3>
                        </Link>
                        <span className="location-text">
                          <MapPin size={14} />
                          {offer.destination} · {offer.subtitle}
                        </span>
                        <div className="tag-row">
                          {(offer.details.amenities ?? offer.details.services ?? [])
                            .slice(0, 3)
                            .map((a) => (
                              <span key={a}>{a}</span>
                            ))}
                        </div>
                        {offer.details.manualConfirmation && (
                          <span className="status-badge">نیازمند تأیید کارشناس</span>
                        )}
                        <Link href={`/offers/${offer.id}`} className="text-link small">
                          {product === 'HOTEL' ? 'اتاق، امکانات و موقعیت' : 'برنامه سفر و شرایط'}{' '}
                          <ArrowUpLeft size={14} />
                        </Link>
                      </div>
                      <div className="listing-price">
                        <small>
                          {product === 'HOTEL' ? 'مجموع اتاق‌ها و شب‌ها' : 'مجموع مسافران'}
                        </small>
                        <strong>
                          {toman(offer.totalIrr ?? offer.priceIrr)} <small>تومان</small>
                        </strong>
                        <Button onClick={() => choose(offer)}>
                          انتخاب {productLabel[product]} <ArrowLeft size={15} />
                        </Button>
                        <small>قیمت نهایی آزمایشی</small>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
            <p className="results-footnote">
              قیمت و ظرفیت هنگام ایجاد رزرو دوباره بررسی می‌شود. تصاویر صرفاً الهام‌بخش هستند؛ همه
              پیشنهادها آزمایشی‌اند.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
function SearchEmpty() {
  return <MapPin size={44} strokeWidth={1} />;
}
