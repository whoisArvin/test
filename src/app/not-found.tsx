import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty-state page-pad">
      <span className="eyebrow">۴۰۴</span>
      <h1>این مسیر هنوز کشف نشده</h1>
      <p>صفحه موردنظر پیدا نشد.</p>
      <Link className="btn btn-primary" href="/">
        بازگشت به صفحه اصلی
      </Link>
    </div>
  );
}
