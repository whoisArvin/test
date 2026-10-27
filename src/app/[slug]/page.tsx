import { notFound } from 'next/navigation';
import { InfoPage } from '@/components/info';
export function generateStaticParams() {
  return ['about', 'contact', 'faq', 'terms', 'visa'].map((slug) => ({ slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    title:
      (
        {
          about: 'درباره برجیس',
          contact: 'تماس با ما',
          faq: 'پرسش‌های متداول',
          terms: 'شرایط و حریم خصوصی',
          visa: 'خدمات ویزا',
        } as Record<string, string>
      )[slug] ?? 'صفحه یافت نشد',
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!['about', 'contact', 'faq', 'terms', 'visa'].includes(slug)) notFound();
  return <InfoPage slug={slug} />;
}
