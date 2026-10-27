'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowUpLeft,
  Menu,
  X,
  UserRound,
  Headphones,
  Plane,
  Camera,
  Send,
  Globe2,
} from 'lucide-react';
import { useApp } from './providers';
import { Button } from './ui/button';
export function Logo() {
  return (
    <Link href="/" className="brand" aria-label="برجیس، صفحه اصلی">
      <span className="brand-mark">
        <svg viewBox="0 0 50 52" fill="none" aria-hidden="true">
          <path
            d="M26 3L7 39l17-8L26 3Zm0 0 17 36-17-8V3Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m7 39 18 10 18-10M25 14l-9 21 9-5 10 5-10-21Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </span>
      <span>
        <strong>برجیس</strong>
        <small>BERJIS</small>
      </span>
    </Link>
  );
}
const links = [
  ['/search?product=FLIGHT', 'بلیط هواپیما'],
  ['/search?product=HOTEL', 'هتل'],
  ['/search?product=TOUR', 'تورهای مسافرتی'],
  ['/visa', 'ویزا'],
  ['/journal', 'مجله سفر'],
];
export function Header() {
  const { user } = useApp(),
    path = usePathname(),
    selectedProduct = useSearchParams().get('product') ?? 'FLIGHT',
    [open, setOpen] = useState(false);
  return (
    <>
      <div className="utility">
        <div className="container">
          <span>برجیس، آغاز سفری فراتر از انتظار</span>
          <div>
            <Link href="/account">پیگیری سفارش</Link>
            <i />
            <Link href="/contact">
              همراه شما در مسیر سفر <Headphones size={14} />
            </Link>
          </div>
        </div>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Logo />
          <nav className={open ? 'nav open' : 'nav'} aria-label="منوی اصلی">
            {links.map(([href, label]) => (
              <Link
                onClick={() => setOpen(false)}
                className={
                  path === href.split('?')[0] &&
                  (path !== '/search' ||
                    new URLSearchParams(href.split('?')[1]).get('product') === selectedProduct)
                    ? 'active'
                    : ''
                }
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Button asChild variant="outline" size="sm">
              <Link href={user ? '/account' : '/login'}>
                <UserRound size={17} />
                {user ? user.name : 'ورود | ثبت‌نام'}
              </Link>
            </Button>
            <button
              className="menu-toggle"
              onClick={() => setOpen(!open)}
              aria-label="باز و بسته کردن فهرست"
              aria-expanded={open}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo />
            <p>
              سفر، فراتر از رسیدن است.
              <br />
              ما همراه لحظه‌هایی هستیم که به خاطره تبدیل می‌شوند.
            </p>
            <span className="footer-social">
              <Link href="/contact" aria-label="ارتباط با برجیس">
                <Camera size={18} />
              </Link>
              <Link href="/contact" aria-label="پشتیبانی برجیس">
                <Send size={18} />
              </Link>
              <Globe2 size={18} />
            </span>
          </div>
          <div>
            <h3>کشف برجیس</h3>
            <Link href="/about">درباره ما</Link>
            <Link href="/journal">مجله گردشگری</Link>
            <Link href="/contact">تماس با ما</Link>
            <Link href="/faq">پرسش‌های متداول</Link>
          </div>
          <div>
            <h3>همراه سفر شما</h3>
            <Link href="/search?product=FLIGHT">بلیط هواپیما</Link>
            <Link href="/search?product=HOTEL">رزرو هتل</Link>
            <Link href="/search?product=TOUR">تورهای منتخب</Link>
            <Link href="/account">سفرهای من</Link>
          </div>
          <div className="footer-note">
            <h3>شفاف، از اولین قدم</h3>
            <p>
              نسخه آزمایشی BERJIS؛ قیمت، ظرفیت، پرداخت و اسناد همگی DEMO و فاقد اعتبار تجاری هستند.
            </p>
            <Link href="/terms">
              شرایط استفاده و حریم خصوصی <ArrowUpLeft size={15} />
            </Link>
            <span className="demo-tag">DEMO ENVIRONMENT</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} برجیس · تمامی حقوق محفوظ است.</span>
          <span>
            با اشتیاق برای سفرهای به‌یادماندنی <Plane size={15} />
          </span>
        </div>
      </div>
    </footer>
  );
}
