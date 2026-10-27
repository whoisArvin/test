'use client';
import { airports } from '@/lib/locations';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker/persian';
import {
  Plane,
  Hotel,
  Compass,
  ArrowLeftRight,
  MapPin,
  CalendarDays,
  Users,
  Search,
  Plus,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button } from './ui/button';
import { persianDate, todayPlus, fa } from './types';
export interface Leg {
  origin: string;
  destination: string;
  date: string;
}
export function PersianDateInput({
  value,
  onChange,
  label,
  min = todayPlus(0),
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  min?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <div className="date-control" ref={ref}>
      <button
        type="button"
        className="date-value"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={label}
      >
        <span>{value ? persianDate(value, true) : label}</span>
        <CalendarDays size={19} />
      </button>
      {open && (
        <div className="calendar-popover">
          <DayPicker
            mode="single"
            selected={value ? new Date(value + 'T12:00:00') : undefined}
            disabled={{ before: new Date(min + 'T00:00:00') }}
            onSelect={(d) => {
              if (d) {
                const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
                onChange(local.toISOString().slice(0, 10));
                setOpen(false);
              }
            }}
            dir="rtl"
          />
          <label className="date-manual">
            ورود تاریخ میلادی
            <input
              type="date"
              value={value}
              min={min}
              onChange={(e) => onChange(e.target.value)}
              aria-label={`${label} میلادی`}
            />
          </label>
        </div>
      )}
    </div>
  );
}
const cities = ['تهران', 'کیش', 'مشهد', 'شیراز', 'استانبول', 'دبی'];
export function SearchForm({
  initialProduct = 'FLIGHT',
  compact = false,
}: {
  initialProduct?: 'FLIGHT' | 'HOTEL' | 'TOUR';
  compact?: boolean;
}) {
  const router = useRouter();
  const [recent, setRecent] = useState<{
    origin: string;
    destination: string;
    start: string;
    product: 'FLIGHT' | 'HOTEL' | 'TOUR';
  } | null>(null);
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem('berjis-recent') ?? 'null');
      if (
        r &&
        typeof r.origin === 'string' &&
        typeof r.destination === 'string' &&
        typeof r.start === 'string' &&
        ['FLIGHT', 'HOTEL', 'TOUR'].includes(r.product)
      )
        setRecent({ ...r, origin: r.origin.slice(0, 80), destination: r.destination.slice(0, 80) });
    } catch {}
  }, []);
  const [product, setProduct] = useState(initialProduct),
    [flightType, setFlightType] = useState('domestic'),
    [mode, setMode] = useState('oneway'),
    [origin, setOrigin] = useState('تهران'),
    [destination, setDestination] = useState('کیش'),
    [start, setStart] = useState(todayPlus(3)),
    [end, setEnd] = useState(todayPlus(6)),
    [quantity, setQuantity] = useState(1),
    [extra, setExtra] = useState<Leg[]>([
      { origin: 'کیش', destination: 'تهران', date: todayPlus(6) },
    ]);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({
      product,
      destination,
      startDate: start,
      endDate: product === 'HOTEL' ? end : start,
      quantity: String(quantity),
    });
    if (product === 'FLIGHT') {
      params.set('origin', origin);
      params.set('flightType', flightType);
      const legs = [
        { origin, destination, date: start },
        ...(mode === 'roundtrip'
          ? [{ origin: destination, destination: origin, date: end }]
          : mode === 'multi'
            ? extra
            : []),
      ];
      params.set('legs', JSON.stringify(legs));
    }
    try {
      localStorage.setItem(
        'berjis-recent',
        JSON.stringify({ origin, destination, start, product })
      );
    } catch {}
    router.push(`/search?${params}`);
  }
  const changeProduct = (p: typeof product) => {
    setProduct(p);
  };
  return (
    <div className={`search-widget ${compact ? 'search-compact' : ''}`}>
      <div className="search-tabs" role="tablist" aria-label="نوع خدمت">
        {(
          [
            { id: 'FLIGHT', label: 'بلیط هواپیما', icon: Plane },
            { id: 'HOTEL', label: 'هتل', icon: Hotel },
            { id: 'TOUR', label: 'تور مسافرتی', icon: Compass },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            role="tab"
            aria-selected={product === id}
            className={product === id ? 'selected' : ''}
            onClick={() => changeProduct(id)}
            key={id}
          >
            <Icon size={21} />
            {label}
          </button>
        ))}
        <span className="search-note">
          <span className="status-dot" />
          یک جستجو، شروع هزار خاطره
        </span>
      </div>
      <form onSubmit={submit}>
        <div className="search-options">
          {product === 'FLIGHT' ? (
            <>
              <div className="segmented">
                <button
                  type="button"
                  className={flightType === 'domestic' ? 'selected' : ''}
                  onClick={() => {
                    setFlightType('domestic');
                    setDestination('کیش');
                  }}
                >
                  پرواز داخلی
                </button>
                <button
                  type="button"
                  className={flightType === 'international' ? 'selected' : ''}
                  onClick={() => {
                    setFlightType('international');
                    setDestination('استانبول');
                  }}
                >
                  پرواز خارجی
                </button>
              </div>
              <select aria-label="نوع سفر" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="oneway">یک‌طرفه</option>
                <option value="roundtrip">رفت‌وبرگشت</option>
                <option value="multi">چندمسیره</option>
              </select>
              <span className="small muted">اکونومی · قیمت آزمایشی</span>
            </>
          ) : (
            <span className="small muted">
              {product === 'HOTEL'
                ? 'اقامت دلخواهتان را پیدا کنید · اتاق دوتخته'
                : 'تجربه‌هایی که به خاطره تبدیل می‌شوند'}
            </span>
          )}
          <button
            type="button"
            className="recent-search"
            onClick={() => {
              if (recent) {
                setOrigin(recent.origin);
                setDestination(recent.destination);
                setStart(recent.start >= todayPlus(0) ? recent.start : todayPlus(3));
                setProduct(recent.product);
              }
            }}
          >
            {recent ? `جستجوی قبلی: ${recent.destination}` : ''}
          </button>
          <span className="demo-inline">DEMO</span>
        </div>
        <div className={`search-fields ${product !== 'FLIGHT' ? 'non-flight' : ''}`}>
          {product === 'FLIGHT' && (
            <>
              <label className="search-field">
                <span>
                  مبدأ <MapPin size={15} />
                </span>
                <input
                  list="berjis-cities"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  aria-label="مبدأ"
                  required
                />
              </label>
              <button
                type="button"
                className="swap-button"
                aria-label="جابه‌جایی مبدأ و مقصد"
                onClick={() => {
                  setOrigin(destination);
                  setDestination(origin);
                }}
              >
                <ArrowLeftRight size={17} />
              </button>
            </>
          )}
          <label className="search-field">
            <span>
              {product === 'HOTEL' ? 'شهر یا نام هتل' : 'مقصد'} <MapPin size={15} />
            </span>
            <input
              list="berjis-cities"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              aria-label="مقصد"
              required
            />
          </label>
          <div className="search-field">
            <span>{product === 'HOTEL' ? 'تاریخ ورود' : 'تاریخ رفت'}</span>
            <PersianDateInput label="تاریخ رفت" value={start} onChange={setStart} />
          </div>
          {(product === 'HOTEL' || (product === 'FLIGHT' && mode === 'roundtrip')) && (
            <div className="search-field">
              <span>{product === 'HOTEL' ? 'تاریخ خروج' : 'تاریخ برگشت'}</span>
              <PersianDateInput label="تاریخ برگشت" value={end} onChange={setEnd} min={start} />
            </div>
          )}
          <label className="search-field quantity-field">
            <span>
              {product === 'HOTEL' ? 'اتاق‌ها' : 'مسافران'} <Users size={15} />
            </span>
            <select
              aria-label={product === 'HOTEL' ? 'تعداد اتاق' : 'تعداد مسافر'}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {fa(i + 1)} {product === 'HOTEL' ? 'اتاق' : 'مسافر'}
                </option>
              ))}
            </select>
          </label>
          <Button className="search-submit" type="submit">
            <Search size={19} />
            جستجو
            <ArrowUpLeftSmall />
          </Button>
        </div>
        {product === 'FLIGHT' && mode === 'multi' && (
          <div className="multi-legs">
            {extra.map((leg, i) => (
              <div className="multi-leg" key={i}>
                <input
                  aria-label={`مبدأ مسیر ${i + 2}`}
                  list="berjis-cities"
                  value={leg.origin}
                  onChange={(e) =>
                    setExtra((a) =>
                      a.map((l, j) => (j === i ? { ...l, origin: e.target.value } : l))
                    )
                  }
                />
                <input
                  aria-label={`مقصد مسیر ${i + 2}`}
                  list="berjis-cities"
                  value={leg.destination}
                  onChange={(e) =>
                    setExtra((a) =>
                      a.map((l, j) => (j === i ? { ...l, destination: e.target.value } : l))
                    )
                  }
                />
                <PersianDateInput
                  value={leg.date}
                  label={`تاریخ مسیر ${i + 2}`}
                  min={start}
                  onChange={(date) =>
                    setExtra((a) => a.map((l, j) => (j === i ? { ...l, date } : l)))
                  }
                />
                <button
                  type="button"
                  aria-label="حذف مسیر"
                  onClick={() => setExtra((a) => a.filter((_, j) => j !== i))}
                >
                  <X size={18} />
                </button>
              </div>
            ))}
            {extra.length < 5 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setExtra((a) => [
                    ...a,
                    {
                      origin: a.at(-1)?.destination ?? destination,
                      destination: 'تهران',
                      date: todayPlus(9),
                    },
                  ])
                }
              >
                <Plus size={16} />
                افزودن مسیر
              </Button>
            )}
          </div>
        )}
        <datalist id="berjis-cities">
          {airports.map((a) => (
            <option value={a.code} key={a.code}>
              {a.city} · {a.name}
            </option>
          ))}
          {cities.map((city) => (
            <option value={city} key={city} />
          ))}
        </datalist>
      </form>
    </div>
  );
}
function ArrowUpLeftSmall() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M17 17 7 7m0 0v9M7 7h9" />
    </svg>
  );
}
