'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShieldCheck,
  ArrowLeft,
  Download,
  Plus,
  Save,
  Check,
  Search,
  UserRound,
} from 'lucide-react';
import { useApp, useResource, api, post } from './providers';
import { Button } from './ui/button';
import { StatusBadge } from './order-details';
import { type Offer, type Order, type Article, toman, fa, persianDate, todayPlus } from './types';
const roleTabs: Record<string, string[]> = {
  SUPER_ADMIN: [
    'overview',
    'orders',
    'tours',
    'hotels',
    'refunds',
    'finance',
    'support',
    'articles',
    'users',
    'suppliers',
    'audit',
  ],
  SALES_MANAGER: ['overview', 'orders', 'tours', 'hotels', 'suppliers'],
  ACCOUNTANT: ['refunds', 'finance'],
  SUPPORT: ['orders', 'support'],
  BOOKING_AGENT: ['orders'],
};
const labels: Record<string, string> = {
  overview: 'نمای کلی',
  orders: 'سفارش‌ها',
  tours: 'مدیریت تور',
  hotels: 'مدیریت هتل',
  refunds: 'استردادها',
  finance: 'گزارش مالی',
  support: 'پشتیبانی',
  articles: 'محتوا',
  users: 'دسترسی کاربران',
  suppliers: 'تأمین‌کنندگان',
  audit: 'تاریخچه عملیات',
};
export function Admin() {
  const { user, loading } = useApp(),
    [tab, setTab] = useState('');
  if (loading)
    return (
      <div className="container page-pad">
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  const allowed = roleTabs[user?.role ?? ''] ?? [];
  if (!allowed.length)
    return (
      <div className="container page-pad">
        <div className="empty-state">
          <ShieldCheck size={40} />
          <h1>دسترسی مدیریتی لازم است</h1>
          <p>این بخش فقط برای همکاران مجاز برجیس در دسترس است. نقش‌ها در سرور بررسی می‌شوند.</p>
          <Button asChild>
            <Link href={user ? '/account' : '/login?next=/admin'}>
              {user ? 'بازگشت به حساب' : 'ورود به حساب'}
            </Link>
          </Button>
        </div>
      </div>
    );
  const current = allowed.includes(tab) ? tab : allowed[0];
  return (
    <div className="container page-pad">
      <div className="dashboard-title">
        <div>
          <span className="eyebrow">BERJIS OPERATIONS · DEMO</span>
          <h1>فضای مدیریت برجیس</h1>
          <p>{user?.name} · تمام گزارش‌ها و تراکنش‌ها در این محیط آزمایشی هستند.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/account">
            <UserRound size={16} />
            حساب من
          </Link>
        </Button>
      </div>
      <nav className="admin-tab-list">
        {allowed.map((t) => (
          <button className={current === t ? 'selected' : ''} key={t} onClick={() => setTab(t)}>
            {labels[t]}
          </button>
        ))}
      </nav>
      {current === 'overview' ? (
        <Overview />
      ) : current === 'orders' ? (
        <AdminOrders />
      ) : current === 'tours' || current === 'hotels' ? (
        <CatalogEditor key={current} kind={current} />
      ) : current === 'refunds' ? (
        <Refunds />
      ) : current === 'finance' ? (
        <Finance />
      ) : current === 'support' ? (
        <AdminSupport />
      ) : current === 'users' ? (
        <UsersEditor />
      ) : current === 'suppliers' ? (
        <Suppliers />
      ) : current === 'audit' ? (
        <Audit />
      ) : (
        <ArticlesEditor />
      )}
    </div>
  );
}
function ResourceError({ error }: { error: string }) {
  return error ? (
    <div className="inline-error" role="alert">
      {error}
    </div>
  ) : null;
}
interface Metrics {
  orders: number;
  confirmed: number;
  failed: number;
  refunds: number;
  salesIrr: number;
  series: { day: string; amount: number }[];
}
function Overview() {
  const { data, error, loading } = useResource<Metrics>('admin/overview');
  if (loading) return <div className="skeleton" style={{ height: 300 }} />;
  if (error || !data) return <ResourceError error={error} />;
  const max = Math.max(1, ...data.series.map((s) => s.amount));
  return (
    <>
      <div className="stat-grid">
        {[
          ['فروش پرداخت‌شده DEMO', `${toman(data.salesIrr)} تومان`],
          ['همه سفارش‌ها', fa(data.orders)],
          ['رزرو تأییدشده', fa(data.confirmed)],
          ['درخواست استرداد باز', fa(data.refunds)],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong style={{ fontSize: 22 }}>{value}</strong>
            <small>از داده‌های همین دیتابیس</small>
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>فروش آزمایشی روزانه</h2>
        {data.series.length ? (
          <div className="chart">
            {[...data.series].reverse().map((s) => (
              <div
                className="chart-bar"
                key={s.day}
                style={{ height: `${Math.max(3, (s.amount / max) * 100)}%` }}
                title={`${persianDate(s.day)}: ${toman(s.amount)} تومان`}
              >
                <span>{persianDate(s.day)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>هنوز پرداخت تأییدشده‌ای ثبت نشده است.</p>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 40 }}>
          سفارش‌های ناموفق: {fa(data.failed)} · درآمد، تسویه بانکی یا فروش واقعی نیست. سفارش‌های
          استردادشده در فروش پرداخت‌شده محاسبه نمی‌شوند.
        </p>
      </div>
    </>
  );
}
function AdminOrders() {
  const [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [open, setOpen] = useState(''),
    { data, error, reload } = useResource<Order[]>(`admin/orders?q=${encodeURIComponent(search)}`),
    { toast } = useApp();
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
        }}
        style={{ display: 'flex', gap: 12, marginBottom: 22 }}
      >
        <input
          className="plain-input"
          placeholder="جستجو با شناسه سفارش"
          aria-label="شناسه سفارش"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit">
          <Search size={18} />
          جستجو
        </Button>
      </form>
      <ResourceError error={error} />
      {data?.length === 0 && (
        <div className="empty-state">
          <p>سفارشی با این مشخصات وجود ندارد.</p>
        </div>
      )}
      {data?.map((o) => (
        <div className="order-card" key={o.id}>
          <div className="order-top">
            <strong dir="ltr">{o.reference}</strong>
            <StatusBadge value={o.status} />
          </div>
          <h3>{o.items.map((i) => i.offer.title).join(' + ')}</h3>
          <div className="order-meta">
            <StatusBadge value={o.paymentStatus} />
            <StatusBadge value={o.fulfilmentStatus} />
            <span>{toman(o.totalIrr)} تومان</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            style={{ marginTop: 15 }}
            onClick={() => setOpen(open === o.id ? '' : o.id)}
          >
            {open === o.id ? 'بستن جزئیات' : 'مشاهده مسافران و تاریخچه'}
          </Button>
          {open === o.id && (
            <div className="notice-box">
              {o.passengers.map((p, i) => (
                <p key={i}>
                  {p.firstName} {p.lastName} · {persianDate(p.birthDate, true)}
                </p>
              ))}
              <div className="timeline">
                {o.audits.map((a) => (
                  <div key={a.id}>
                    <span dir="ltr">{a.action}</span>
                    <small>{persianDate(a.createdAt, true)}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
          {o.status === 'CONFIRMING' && <ManualApprove id={o.id} onDone={reload} />}
        </div>
      ))}
    </>
  );
}
function ManualApprove({ id, onDone }: { id: string; onDone: () => Promise<void> }) {
  const { user, toast } = useApp(),
    [busy, setBusy] = useState(false);
  if (!['SUPER_ADMIN', 'BOOKING_AGENT'].includes(user?.role ?? '')) return null;
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await post(`admin/orders/${id}/approve`);
          toast('بررسی دستی انجام شد.');
          await onDone();
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      تأیید دستی آزمایشی
    </Button>
  );
}
function CatalogEditor({ kind }: { kind: 'tours' | 'hotels' }) {
  const { data, error, reload } = useResource<Offer[]>(`admin/${kind}`),
    [editing, setEditing] = useState<Offer | null | undefined>(undefined),
    [busy, setBusy] = useState(false),
    { toast } = useApp();
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? '');
    const split = (k: string) =>
      str(k)
        .split('\n')
        .map((v) => v.trim())
        .filter(Boolean);
    const input =
      kind === 'tours'
        ? {
            title: str('title'),
            subtitle: str('subtitle'),
            destination: str('destination'),
            priceIrr: Number(str('price')) * 10,
            date: str('date'),
            total: Number(str('total')),
            published: fd.get('published') === 'on',
            details: {
              duration: str('duration'),
              transport: str('transport'),
              services: split('services'),
              itinerary: split('itinerary'),
              documents: str('documents'),
              rules: str('rules'),
              manualConfirmation: fd.get('manual') === 'on',
            },
          }
        : {
            title: str('title'),
            subtitle: str('subtitle'),
            priceIrr: Number(str('price')) * 10,
            date: str('date'),
            total: Number(str('total')),
            published: fd.get('published') === 'on',
            details: {
              roomType: str('roomType'),
              stars: Number(str('stars')),
              amenities: split('services'),
              rules: str('rules'),
            },
          };
    try {
      await api(`admin/${kind}${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      });
      setEditing(undefined);
      toast('تغییرات ذخیره و در تاریخچه ثبت شد.');
      await reload();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="notice-box">
        قیمت و ظرفیت DEMO هستند. ظرفیت فقط برای تاریخ انتخابی تغییر می‌کند؛ رزروهای قبلی و قیمت
        ثبت‌شده آن‌ها حفظ می‌شوند. حذف از فروش با برداشتن گزینه «منتشرشده» انجام می‌شود.
      </div>
      <ResourceError error={error} />
      {kind === 'tours' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(null)}
          style={{ marginBottom: 20 }}
        >
          <Plus size={16} />
          ایجاد تور
        </Button>
      )}
      {editing !== undefined && (
        <form className="panel" onSubmit={save} key={editing?.id ?? 'new'}>
          <h2>{editing ? 'ویرایش محصول' : 'تور جدید'}</h2>
          <div className="form-grid">
            <label className="form-label">
              عنوان
              <input name="title" defaultValue={editing?.title} required minLength={3} />
            </label>
            <label className="form-label">
              زیرعنوان
              <input name="subtitle" defaultValue={editing?.subtitle} required />
            </label>
            {kind === 'tours' && (
              <label className="form-label">
                مقصد
                <input name="destination" defaultValue={editing?.destination} required />
              </label>
            )}
            <label className="form-label">
              قیمت به تومان
              <input
                type="number"
                name="price"
                defaultValue={editing ? editing.priceIrr / 10 : 1000000}
                min={1000}
                max={100000000}
                required
              />
            </label>
            <label className="form-label">
              تاریخ موجودی (میلادی)
              <input
                type="date"
                name="date"
                defaultValue={editing?.inventory?.[0]?.date.slice(0, 10) ?? todayPlus(3)}
                required
              />
            </label>
            <label className="form-label">
              ظرفیت کل همان روز
              <input
                type="number"
                name="total"
                defaultValue={editing?.inventory?.[0]?.total ?? 12}
                min={kind === 'tours' ? 1 : 0}
                max={500}
                required
              />
            </label>
            {kind === 'tours' ? (
              <>
                <label className="form-label">
                  مدت سفر
                  <input
                    name="duration"
                    defaultValue={editing?.details.duration ?? '۳ شب و ۴ روز'}
                    required
                  />
                </label>
                <label className="form-label">
                  روش سفر
                  <select name="transport" defaultValue={editing?.details.transport ?? 'هوایی'}>
                    <option>هوایی</option>
                    <option>زمینی</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="form-label">
                  نوع اتاق
                  <input name="roomType" defaultValue={editing?.details.roomType} required />
                </label>
                <label className="form-label">
                  ستاره هتل
                  <input
                    name="stars"
                    type="number"
                    min={1}
                    max={5}
                    defaultValue={editing?.details.stars}
                    required
                  />
                </label>
              </>
            )}
            <label className="form-label">
              {kind === 'tours' ? 'خدمات' : 'امکانات'} (هر مورد یک خط)
              <textarea
                name="services"
                defaultValue={(editing?.details.services ?? editing?.details.amenities ?? []).join(
                  '\n'
                )}
              />
            </label>
            {kind === 'tours' && (
              <>
                <label className="form-label">
                  برنامه روزها (هر روز یک خط)
                  <textarea
                    name="itinerary"
                    defaultValue={editing?.details.itinerary?.join('\n')}
                  />
                </label>
                <label className="form-label">
                  مدارک لازم
                  <textarea name="documents" defaultValue={editing?.details.documents} />
                </label>
              </>
            )}
            <label className="form-label">
              قوانین لغو و شرایط
              <textarea name="rules" defaultValue={editing?.details.rules} />
            </label>
          </div>
          <label className="check-label">
            <input type="checkbox" name="published" defaultChecked={editing?.published ?? true} />
            منتشرشده و قابل جستجو
          </label>
          {kind === 'tours' && (
            <label className="check-label">
              <input
                type="checkbox"
                name="manual"
                defaultChecked={editing?.details.manualConfirmation}
              />
              نیازمند تأیید دستی کارشناس
            </label>
          )}
          <div className="form-actions">
            <Button type="submit" disabled={busy}>
              <Save size={16} />
              ذخیره
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(undefined)}>
              بستن فرم
            </Button>
          </div>
        </form>
      )}
      <div className="table-scroll" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr>
              <th>محصول</th>
              <th>مقصد</th>
              <th>قیمت پایه، تومان</th>
              <th>انتشار</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((o) => (
              <tr key={o.id}>
                <td>{o.title}</td>
                <td>{o.destination}</td>
                <td>{toman(o.priceIrr)}</td>
                <td>{o.published ? 'منتشرشده' : 'خارج از فروش'}</td>
                <td>
                  <Button size="sm" variant="outline" onClick={() => setEditing(o)}>
                    ویرایش
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
interface Refund {
  id: string;
  reason: string;
  amountIrr: number;
  status: string;
  reservation: { reference: string; status: string };
}
function Refunds() {
  const { data, error, reload } = useResource<Refund[]>('admin/refunds'),
    { toast } = useApp(),
    [busy, setBusy] = useState('');
  return (
    <>
      <ResourceError error={error} />
      <div className="notice-box">
        تأیید کارشناس، کار استرداد را به صف می‌فرستد. وضعیت تسویه فقط پس از پاسخ درگاه DEMO تغییر
        می‌کند.
      </div>
      {data?.length === 0 && (
        <div className="empty-state">
          <p>درخواست استردادی وجود ندارد.</p>
        </div>
      )}
      {data?.map((r) => (
        <div className="order-card" key={r.id}>
          <div className="order-top">
            <strong dir="ltr">{r.reservation.reference}</strong>
            <StatusBadge value={r.status} />
          </div>
          <p className="detail-text">{r.reason}</p>
          <div className="order-bottom">
            <strong>
              {toman(r.amountIrr)} <small>تومان</small>
            </strong>
            {r.status === 'REQUESTED' && (
              <Button
                size="sm"
                disabled={!!busy}
                onClick={async () => {
                  setBusy(r.id);
                  try {
                    await post(`admin/refunds/${r.id}`);
                    toast('استرداد برای پردازش آزمایشی ثبت شد.');
                    await reload();
                  } catch (e) {
                    toast((e as Error).message, true);
                  } finally {
                    setBusy('');
                  }
                }}
              >
                تأیید استرداد
              </Button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
function Finance() {
  return (
    <div className="panel">
      <h2>گزارش مالی و تراکنش‌ها</h2>
      <p className="detail-text">
        گزارش شامل شناسه سفارش، مبلغ ریالی، وضعیت مستقل پرداخت و رزرو و نوع درگاه است. فایل CSV با
        Excel باز می‌شود. تمام مبالغ مربوط به تراکنش آزمایشی‌اند؛ تسویه بانکی و صورت‌حساب رسمی فعال
        نیست.
      </p>
      <Button asChild style={{ marginTop: 25 }}>
        <a href="/api/v1/admin/finance">
          <Download size={18} />
          دریافت CSV مالی DEMO
        </a>
      </Button>
    </div>
  );
}
interface Ticket {
  id: string;
  subject: string;
  message: string;
  reply?: string;
  status: string;
}
function AdminSupport() {
  const { data, error, reload } = useResource<Ticket[]>('admin/support'),
    { toast } = useApp();
  return (
    <>
      <ResourceError error={error} />
      {data?.length === 0 && (
        <div className="empty-state">
          <p>تیکتی ثبت نشده است.</p>
        </div>
      )}
      {data?.map((t) => (
        <form
          className="ticket-card"
          key={t.id}
          onSubmit={async (e) => {
            e.preventDefault();
            const reply = String(new FormData(e.currentTarget).get('reply'));
            try {
              await post(`admin/support/${t.id}`, { reply });
              toast('پاسخ ثبت شد.');
              await reload();
            } catch (e) {
              toast((e as Error).message, true);
            }
          }}
        >
          <h3>{t.subject}</h3>
          <p>{t.message}</p>
          <label className="form-label" style={{ marginTop: 18 }}>
            پاسخ پشتیبانی
            <textarea name="reply" defaultValue={t.reply} minLength={5} required />
          </label>
          <Button size="sm" style={{ marginTop: 15 }}>
            ثبت پاسخ
          </Button>
        </form>
      ))}
    </>
  );
}
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}
const roleNames: Record<string, string> = {
  CUSTOMER: 'مشتری',
  SUPPORT: 'پشتیبان',
  BOOKING_AGENT: 'کارشناس رزرو',
  SALES_MANAGER: 'مدیر فروش',
  ACCOUNTANT: 'حسابدار',
  SUPER_ADMIN: 'مدیر کل',
};
function UsersEditor() {
  const { data, error, reload } = useResource<AdminUser[]>('admin/users'),
    { user, toast } = useApp();
  return (
    <>
      <ResourceError error={error} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>نام</th>
              <th>ایمیل</th>
              <th>نقش</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td dir="ltr">{u.email}</td>
                <td>
                  <select
                    aria-label={`نقش ${u.name}`}
                    value={u.role}
                    disabled={u.id === user?.id}
                    onChange={async (e) => {
                      try {
                        await api(`admin/users/${u.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ role: e.target.value }),
                        });
                        toast('نقش کاربر تغییر کرد.');
                        await reload();
                      } catch (e) {
                        toast((e as Error).message, true);
                      }
                    }}
                  >
                    {Object.entries(roleNames).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Suppliers() {
  const { data, error } =
    useResource<{ id: string; name: string; mode: string }[]>('admin/suppliers');
  return (
    <>
      <ResourceError error={error} />
      <div className="notice-box">
        اتصال واقعی نیازمند قرارداد، مشخصات API و اعتبارنامه امن است. تنها adapter آزمایشی فعال است؛
        تغییر یک گزینه، اتصال واقعی ایجاد نمی‌کند.
      </div>
      {data?.map((s) => (
        <div className="panel" key={s.id}>
          <h2>{s.name}</h2>
          <span className="demo-tag">{s.mode}</span>
          <p className="detail-text" style={{ marginTop: 15 }}>
            جستجو، نگهداری ظرفیت و صدور آزمایشی برای پرواز، هتل و تور.
          </p>
        </div>
      ))}
    </>
  );
}
function Audit() {
  const { data, error } =
    useResource<
      { id: string; actorId: string; action: string; createdAt: string; reservationId?: string }[]
    >('admin/audit');
  return (
    <>
      <ResourceError error={error} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>زمان</th>
              <th>عملیات</th>
              <th>عامل</th>
              <th>شناسه سفارش</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((a) => (
              <tr key={a.id}>
                <td>{persianDate(a.createdAt, true)}</td>
                <td dir="ltr">{a.action}</td>
                <td dir="ltr">{a.actorId}</td>
                <td dir="ltr">{a.reservationId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function ArticlesEditor() {
  const { data, error, reload } = useResource<Article[]>('admin/articles'),
    [editing, setEditing] = useState<Article | null>(null),
    { toast } = useApp();
  return (
    <>
      <ResourceError error={error} />
      {editing && (
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            try {
              await api(`admin/articles/${editing.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  title: String(fd.get('title')),
                  excerpt: String(fd.get('excerpt')),
                  body: String(fd.get('body')),
                  published: fd.get('published') === 'on',
                }),
              });
              toast('مقاله ذخیره شد.');
              setEditing(null);
              await reload();
            } catch (e) {
              toast((e as Error).message, true);
            }
          }}
        >
          <h2>ویرایش مقاله</h2>
          <div className="form-grid">
            <label className="form-label">
              عنوان
              <input name="title" defaultValue={editing.title} required />
            </label>
            <label className="form-label">
              خلاصه
              <input name="excerpt" defaultValue={editing.excerpt} required />
            </label>
          </div>
          <label className="form-label" style={{ marginTop: 20 }}>
            متن
            <textarea name="body" defaultValue={editing.body} required minLength={20} rows={9} />
          </label>
          <label className="check-label">
            <input name="published" type="checkbox" defaultChecked={editing.published} />
            منتشرشده
          </label>
          <Button style={{ marginTop: 20 }}>ذخیره محتوا</Button>
        </form>
      )}
      <div className="table-scroll" style={{ marginTop: 25 }}>
        <table>
          <thead>
            <tr>
              <th>مقاله</th>
              <th>انتشار</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td>{a.published ? 'منتشرشده' : 'پیش‌نویس'}</td>
                <td>
                  <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                    ویرایش
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
