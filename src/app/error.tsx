'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state page-pad">
      <h1>ارتباط با سرویس برقرار نشد</h1>
      <p>لطفاً کمی بعد دوباره تلاش کنید. جزئیات فنی در گزارش سرور ثبت می‌شود.</p>
      <Button onClick={reset}>تلاش دوباره</Button>
    </div>
  );
}
