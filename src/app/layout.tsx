import { Suspense } from 'react';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import 'react-day-picker/style.css';
import './globals.css';
import { Providers } from '@/components/providers';
import { Header, Footer } from '@/components/shell';
export const metadata: Metadata = {
  title: { default: 'برجیس | آغاز سفری فراتر از انتظار', template: '%s | برجیس' },
  description:
    'جستجو و رزرو پرواز، هتل و تور در نسخه آزمایشی برجیس. تجربه‌ای روشن، ساده و الهام‌بخش برای برنامه‌ریزی سفر.',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="fa" dir="rtl">
      <body>
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'برجیس — BERJIS (DEMO)',
              inLanguage: 'fa-IR',
              description: 'محیط آزمایشی جستجو و رزرو سفر برجیس',
            }),
          }}
        />
        <Providers>
          <a className="skip-link" href="#main">
            رفتن به محتوای اصلی
          </a>
          <Suspense fallback={<div style={{ height: 88 }} />}>
            <Header />
          </Suspense>
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
