'use client';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  UserRound,
  Plane,
  Users,
  Headphones,
  RotateCcw,
  Bell,
  LayoutDashboard,
  LogOut,
  ArrowLeft,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useApp, useResource, post, api } from './providers';
import { type Order, toman, fa, persianDate, productLabel, type Passenger } from './types';
import { Button } from './ui/button';
import { StatusBadge } from './order-details';
const tabs = [
  ['orders', 'سفرهای من', Plane],
  ['travelers', 'مسافران', Users],
  ['refunds', 'پیگیری استرداد', RotateCcw],
  ['notifications', 'اعلان‌ها', Bell],
  ['support', 'پشتیبانی', Headphones],
  ['profile', 'حساب کاربری', UserRound],
] as const;
export function Account() {
  const { user, loading, refresh } = useApp(),
    params = useSearchParams(),
    router = useRouter();
  const tab = params.get('tab') ?? 'orders';
  if (loading)
    return (
      <div className="container page-pad">
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  if (!user)
    return (
      <div className="container page-pad">
        <div className="empty-state">
          <UserRound size={42} />
          <h1>سفرهای شما، در یک نگاه</h1>
          <p>برای مشاهده سفارش‌ها و مدیریت حساب، وارد شوید.</p>
          <Button asChild>
            <Link href="/login?next=/account">ورود یا ثبت‌نام</Link>
          </Button>
        </div>
      </div>
    );
  return (
    <div className="container page-pad">
      <div className="dashboard-layout">
        <aside className="dashboard-nav">
          <div className="user-avatar">
            <UserRound size={25} />
          </div>
          <h3>{user.name}</h3>
          <small dir="ltr">{user.email}</small>
          <nav className="dashboard-links">
            {tabs.map(([id, label, Icon]) => (
              <Link className={tab === id ? 'selected' : ''} href={`/account?tab=${id}`} key={id}>
                <Icon size={17} />
                {label}
              </Link>
            ))}
            {user.role !== 'CUSTOMER' && (
              <Link href="/admin">
                <LayoutDashboard size={17} />
                مدیریت برجیس
              </Link>
            )}
            <button
              onClick={async () => {
                await post('auth/logout');
                await refresh();
                router.push('/');
              }}
            >
              <LogOut size={17} />
              خروج از حساب
            </button>
          </nav>
        </aside>
        <section>
          <div className="dashboard-title">
            <div>
              <span className="eyebrow">به فضای سفر خود خوش آمدید</span>
              <h1>{tabs.find((t) => t[0] === tab)?.[1] ?? 'سفرهای من'}</h1>
              <p>سلام {user.name}؛ داستان بعدی سفرتان را اینجا دنبال کنید.</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/search">
                سفر تازه <Plus size={15} />
              </Link>
            </Button>
          </div>
          {tab === 'travelers' ? (
            <Travelers />
          ) : tab === 'support' ? (
            <Support />
          ) : tab === 'notifications' ? (
            <Notifications />
          ) : tab === 'profile' ? (
            <div className="panel">
              <h2>اطلاعات حساب</h2>
              <div className="summary-line">
                <span>نام</span>
                <strong>{user.name}</strong>
              </div>
              <div className="summary-line">
                <span>ایمیل</span>
                <strong dir="ltr">{user.email}</strong>
              </div>
              <div className="notice-box">
                <ShieldCheck size={15} style={{ display: 'inline', marginLeft: 5 }} />
                نشست شما با کوکی HttpOnly محافظت می‌شود. ویرایش ایمیل و بازیابی رمز عبور به سرویس
                تأیید هویت نیاز دارد و هنوز فعال نیست.
              </div>
            </div>
          ) : (
            <Orders refundOnly={tab === 'refunds'} />
          )}
        </section>
      </div>
    </div>
  );
}
function Orders({ refundOnly }: { refundOnly: boolean }) {
  const { data, error, loading } = useResource<Order[]>('orders');
  if (loading) return <div className="skeleton" style={{ height: 320 }} />;
  if (error) return <div className="inline-error">{error}</div>;
  const orders = (data ?? []).filter((o) => !refundOnly || o.refunds.length > 0);
  return (
    <>
      {!refundOnly && (
        <div className="stat-grid">
          <div className="stat-card">
            <span>همه سفارش‌ها</span>
            <strong>{fa(data?.length ?? 0)}</strong>
            <small>نسخه آزمایشی</small>
          </div>
          <div className="stat-card">
            <span>صدور آزمایشی موفق</span>
            <strong>{fa(data?.filter((o) => o.status === 'CONFIRMED').length ?? 0)}</strong>
            <small>فاقد اعتبار سفر</small>
          </div>
          <div className="stat-card">
            <span>در انتظار بررسی</span>
            <strong>{fa(data?.filter((o) => o.status === 'CONFIRMING').length ?? 0)}</strong>
            <small>نتیجه تأمین‌کننده</small>
          </div>
          <div className="stat-card">
            <span>درخواست استرداد</span>
            <strong>{fa(data?.filter((o) => o.refunds.length).length ?? 0)}</strong>
            <small>قابل پیگیری</small>
          </div>
        </div>
      )}
      {orders.length ? (
        orders.map((order) => (
          <div className="order-card" key={order.id}>
            <div className="order-top">
              <div>
                <span className="demo-mini">DEMO</span>
                <small dir="ltr">{order.reference}</small>
              </div>
              <StatusBadge value={order.status} />
            </div>
            <h3>{order.items.map((i) => i.offer.title).join(' + ')}</h3>
            <div className="order-meta">
              <span>{productLabel[order.product]}</span>
              <span>{persianDate(order.items[0].startDate, true)}</span>
              <span>{fa(order.passengers.length)} مسافر</span>
            </div>
            <div className="order-bottom">
              <strong>
                {toman(order.totalIrr)} <small>تومان</small>
              </strong>
              <Button asChild size="sm" variant="outline">
                <Link href={`/orders/${order.id}`}>
                  جزئیات و پیگیری <ArrowLeft size={14} />
                </Link>
              </Button>
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <Plane size={40} strokeWidth={1.2} />
          <h2>{refundOnly ? 'درخواست استردادی ندارید' : 'داستان سفر شما از اینجا شروع می‌شود'}</h2>
          <p>
            {refundOnly
              ? 'درخواست کنسلی و استرداد را از صفحه جزئیات سفارش ثبت کنید.'
              : 'هنوز سفری رزرو نکرده‌اید؛ مقصد بعدی‌تان را کشف کنید.'}
          </p>
          <Button asChild>
            <Link href="/search">
              کشف سفرها <ArrowLeft size={17} />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
function Travelers() {
  const { data, error, reload } =
    useResource<(Omit<Passenger, 'documentNumber'> & { id: string })[]>('travelers');
  const { toast } = useApp(),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const input = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await post('travelers', input);
      setShow(false);
      toast('مسافر آزمایشی ذخیره شد.');
      await reload();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setShow(!show)}>
        <Plus size={16} />
        افزودن مسافر آزمایشی
      </Button>
      <div className="notice-box">
        اطلاعات مدرک رمزگذاری می‌شوند و در API نمایش داده نمی‌شوند. برای رزرو، مدرک را دوباره وارد
        کنید.
      </div>
      {show && (
        <form className="panel" onSubmit={save}>
          <div className="form-grid">
            <label className="form-label">
              نام
              <input name="firstName" minLength={2} required />
            </label>
            <label className="form-label">
              نام خانوادگی
              <input name="lastName" minLength={2} required />
            </label>
            <label className="form-label">
              تاریخ تولد میلادی
              <input
                type="date"
                name="birthDate"
                required
                max={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label className="form-label">
              شماره مدرک آزمایشی
              <input name="documentNumber" pattern="[A-Za-z0-9]{6,20}" required />
            </label>
          </div>
          <Button style={{ marginTop: 20 }} disabled={busy}>
            ذخیره مسافر
          </Button>
        </form>
      )}
      {error && <div className="inline-error">{error}</div>}
      {data?.length ? (
        <div className="table-scroll" style={{ marginTop: 24 }}>
          <table>
            <thead>
              <tr>
                <th>نام مسافر</th>
                <th>تاریخ تولد</th>
                <th>مدیریت</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.firstName} {t.lastName}
                  </td>
                  <td>{persianDate(t.birthDate, true)}</td>
                  <td>
                    <button
                      className="delete-button"
                      onClick={async () => {
                        try {
                          await api(`travelers/${t.id}`, { method: 'DELETE', body: '{}' });
                          await reload();
                        } catch (e) {
                          toast((e as Error).message, true);
                        }
                      }}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state" style={{ marginTop: 20 }}>
          <Users size={35} />
          <p>هنوز مسافری ذخیره نشده است.</p>
        </div>
      )}
    </>
  );
}
interface Ticket {
  id: string;
  subject: string;
  message: string;
  reply?: string;
  status: string;
  createdAt: string;
}
function Support() {
  const { data, reload, error } = useResource<Ticket[]>('support'),
    { toast } = useApp(),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      await post('support', Object.fromEntries(new FormData(form)));
      form.reset();
      toast('تیکت پشتیبانی ثبت شد.');
      await reload();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form className="panel" onSubmit={save}>
        <h2>چطور می‌توانیم همراهتان باشیم؟</h2>
        <label className="form-label">
          موضوع
          <input name="subject" minLength={5} maxLength={120} required />
        </label>
        <label className="form-label" style={{ marginTop: 18 }}>
          پیام شما
          <textarea name="message" minLength={10} maxLength={3000} required />
        </label>
        <Button style={{ marginTop: 20 }} disabled={busy}>
          ثبت تیکت
        </Button>
        <p className="small muted" style={{ marginTop: 15 }}>
          این محیط آزمایشی است؛ زمان پاسخ‌گویی تجاری تضمین نمی‌شود.
        </p>
      </form>
      <div style={{ marginTop: 25 }}>
        {error && <div className="inline-error">{error}</div>}
        {data?.map((t) => (
          <div className="ticket-card" key={t.id}>
            <span className="status-badge">
              {t.status === 'OPEN' ? 'در انتظار پاسخ' : 'پاسخ داده شد'}
            </span>
            <h3>{t.subject}</h3>
            <p>{t.message}</p>
            {t.reply && (
              <div className="ticket-reply">
                <strong className="small">پاسخ پشتیبانی</strong>
                <p>{t.reply}</p>
              </div>
            )}
            <small className="muted">{persianDate(t.createdAt, true)}</small>
          </div>
        ))}
      </div>
    </>
  );
}

function Notifications() {
  const { data, error, reload } =
    useResource<
      { id: string; title: string; reservationId?: string; readAt?: string; createdAt: string }[]
    >('notifications');
  const { toast } = useApp();
  return (
    <>
      <ResourceErrorLocal error={error} />
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await post('notifications/read');
            await reload();
          } catch (e) {
            toast((e as Error).message, true);
          }
        }}
      >
        علامت‌گذاری همه به‌عنوان خوانده‌شده
      </Button>
      <div style={{ marginTop: 22 }}>
        {data?.length === 0 ? (
          <div className="empty-state">
            <p>اعلانی ندارید.</p>
          </div>
        ) : (
          data?.map((n) => (
            <div className="ticket-card" key={n.id}>
              <span className="status-badge">{n.readAt ? 'خوانده‌شده' : 'جدید'}</span>
              <h3>{n.title}</h3>
              <small className="muted">{persianDate(n.createdAt, true)}</small>
              {n.reservationId && (
                <Link
                  href={`/orders/${n.reservationId}`}
                  className="text-link small"
                  style={{ display: 'flex', marginTop: 15 }}
                >
                  پیگیری سفارش <ArrowLeft size={14} />
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
function ResourceErrorLocal({ error }: { error: string }) {
  return error ? <div className="inline-error">{error}</div> : null;
}
