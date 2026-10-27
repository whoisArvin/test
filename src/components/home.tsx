'use client';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpLeft,
  ShieldCheck,
  Headphones,
  Wallet,
  Route,
  MapPin,
  Clock,
  Plane,
  Star,
  Sparkles,
  ChevronLeft,
  Compass,
  Hotel,
} from 'lucide-react';
import { SearchForm } from './search-form';
import { useResource } from './providers';
import { Button } from './ui/button';
import { toman, type Offer, type Article, todayPlus } from './types';
const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};
export function TourCard({ offer }: { offer: Offer }) {
  return (
    <Link className="travel-card" href={`/offers/${offer.id}`}>
      <div className="card-image">
        <Image
          src={offer.image}
          alt={`تصویر الهام‌بخش سفر به ${offer.destination}`}
          fill
          sizes="(max-width: 600px) 90vw, 30vw"
        />
        <span className="image-label">
          <Plane size={13} />
          {offer.details.transport ?? 'هوایی'}
        </span>
        <span className="image-arrow">
          <ArrowUpLeft size={18} />
        </span>
        <div className="card-image-bottom">
          <MapPin size={14} />
          {offer.destination}
        </div>
      </div>
      <div className="card-body">
        <span className="card-kicker">
          سفرهای منتخب برجیس <span className="demo-mini">DEMO</span>
        </span>
        <h3>{offer.title}</h3>
        <div className="card-meta">
          <span>
            <Clock size={14} />
            {offer.details.duration}
          </span>
          <span>
            <Hotel size={14} />
            اقامت با صبحانه
          </span>
        </div>
        <div className="card-price">
          <small>شروع از، هر نفر</small>
          <strong>
            {toman(offer.priceIrr)} <small>تومان</small>
          </strong>
          <ChevronLeft size={18} />
        </div>
      </div>
    </Link>
  );
}
export function Home() {
  const { data, error } = useResource<{ offers: Offer[]; articles: Article[] }>('catalog');
  const tours = data?.offers.filter((o) => o.product === 'TOUR') ?? [];
  return (
    <>
      <section className="hero">
        <Image
          className="hero-photo"
          src="/images/travel-hero.jpg"
          alt="چشم‌اندازی از ساحل مدیترانه و بندر پورتوفینو"
          fill
          priority
          sizes="100vw"
        />
        <div className="hero-shade" />
        <div className="container hero-content">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="hero-eyebrow">
              <span /> جهان را، جور دیگری ببینید
            </span>
            <h1>
              هر سفر،
              <br />
              آغاز یک <em>داستان تازه.</em>
            </h1>
            <p>
              از رؤیای مقصد تا لحظه رسیدن، همراه شما هستیم.
              <br />
              پرواز، هتل و تجربه‌هایی فراتر از انتظار را با برجیس کشف کنید.
            </p>
            <Link href="/search?product=TOUR" className="hero-explore">
              مقصد بعدی‌تان را کشف کنید{' '}
              <span>
                <ArrowUpLeft size={19} />
              </span>
            </Link>
          </motion.div>
          <div className="hero-location">
            <MapPin size={17} />
            <span>
              الهام از جهان<small>پورتوفینو، ایتالیا</small>
            </span>
            <span className="location-line" />
          </div>
          <div className="hero-index">
            <b>01</b>
            <span>/</span>03
            <div>
              <i className="active" />
              <i />
              <i />
            </div>
          </div>
        </div>
      </section>
      <div className="container home-search">
        <SearchForm />
      </div>
      <section className="container trust-row">
        {[
          { icon: ShieldCheck, title: 'شفافیت در هر قدم', text: 'قیمت نهایی، پیش از رزرو' },
          { icon: Headphones, title: 'همراهی در مسیر سفر', text: 'پیگیری درخواست در حساب کاربری' },
          { icon: Wallet, title: 'پرداخت با خیال آسوده', text: 'بررسی و تأیید سمت سرور' },
          { icon: Route, title: 'انتخابی به سلیقه شما', text: 'پرواز، هتل و تور در یک مسیر' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <span className="trust-icon">
              <Icon size={25} strokeWidth={1.4} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>
      <section className="section-soft">
        <div className="container">
          <motion.div {...fade} className="section-heading">
            <div>
              <span className="eyebrow">سفرهایی که باید تجربه کرد</span>
              <h2>
                برای سفر بعدی، <span>الهام بگیرید</span>
              </h2>
              <p>مقصدهای دوست‌داشتنی، با تجربه‌ای به سبک برجیس.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/search?product=TOUR">
                همه تورها
                <ArrowLeft size={16} />
              </Link>
            </Button>
          </motion.div>
          <div className="cards-grid">
            {tours.length ? (
              tours.slice(0, 3).map((offer) => (
                <motion.div {...fade} key={offer.id}>
                  <TourCard offer={offer} />
                </motion.div>
              ))
            ) : error ? (
              <div className="inline-error">{error}</div>
            ) : (
              [1, 2, 3].map((i) => <div className="skeleton card-skeleton" key={i} />)
            )}
          </div>
          <div className="demo-disclosure">
            <ShieldCheck size={15} />
            <span>
              این محیط آزمایشی است. همه قیمت‌ها و رزروها DEMO هستند و پرداخت واقعی انجام نمی‌شود.
            </span>
          </div>
        </div>
      </section>
      <section className="container section-pad">
        <div className="section-heading">
          <div>
            <span className="eyebrow">هر مقصد، یک دنیای تازه</span>
            <h2>
              کجا دوست دارید <span>بیدار شوید؟</span>
            </h2>
          </div>
          <Link className="text-link" href="/search?product=HOTEL">
            کشف اقامتگاه‌ها <ArrowLeft size={16} />
          </Link>
        </div>
        <div className="destination-grid">
          {[
            {
              name: 'کیش',
              en: 'KISH ISLAND',
              image: '/images/kish.jpg',
              text: 'آرامش، به رنگ خلیج فارس',
            },
            {
              name: 'استانبول',
              en: 'ISTANBUL',
              image: '/images/istanbul.jpg',
              text: 'یک شهر، هزار داستان',
            },
            {
              name: 'دبی',
              en: 'DUBAI',
              image: '/images/dubai.jpg',
              text: 'به استقبال تجربه‌های نو',
            },
            {
              name: 'شیراز',
              en: 'SHIRAZ',
              image: '/images/shiraz.jpg',
              text: 'مقصدی به لطافت شعر',
            },
          ].map((d, i) => (
            <Link
              className={`destination destination-${i}`}
              key={d.name}
              href={`/search?product=HOTEL&destination=${encodeURIComponent(d.name)}&startDate=${todayPlus(3)}&endDate=${todayPlus(6)}`}
            >
              <Image
                src={d.image}
                fill
                sizes="(max-width:600px) 45vw, 25vw"
                alt={`تصویر الهام‌بخش ${d.name}`}
              />
              <div className="destination-shade" />
              <div className="destination-copy">
                <small>{d.en}</small>
                <h3>{d.name}</h3>
                <p>{d.text}</p>
              </div>
              <span className="destination-arrow">
                <ArrowUpLeft size={19} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="container">
        <div className="brand-banner">
          <div className="banner-decoration" aria-hidden="true">
            <Compass strokeWidth={0.6} />
          </div>
          <div>
            <span className="eyebrow">تجربه‌ای به امضای برجیس</span>
            <h2>
              جزئیات کوچک،
              <br />
              سفرهای <span>به‌یادماندنی.</span>
            </h2>
            <p>
              ما به سفر، فراتر از یک مقصد نگاه می‌کنیم.
              <br />
              برای هر سلیقه، فرصتی برای کشف و تجربه‌ای برای ماندن.
            </p>
            <Button asChild variant="secondary">
              <Link href="/about">
                داستان برجیس <ArrowUpLeft size={17} />
              </Link>
            </Button>
          </div>
          <div className="banner-detail">
            <Sparkles size={25} />
            <span>
              با دقت انتخاب شده
              <br />
              <strong>با اشتیاق به سفر</strong>
            </span>
            <i />
          </div>
        </div>
      </section>
      <section className="container section-pad">
        <div className="section-heading">
          <div>
            <span className="eyebrow">کمی بخوانید، بیشتر سفر کنید</span>
            <h2>
              روایت‌هایی از <span>مجله سفر</span>
            </h2>
          </div>
          <Link href="/journal" className="text-link">
            همه نوشته‌ها <ArrowLeft size={16} />
          </Link>
        </div>
        <div className="journal-grid">
          {data?.articles.map((article) => (
            <Link className="journal-card" href={`/journal/${article.id}`} key={article.id}>
              <div className="journal-image">
                <Image
                  src={article.image}
                  fill
                  sizes="(max-width:600px) 90vw,30vw"
                  alt="تصویر الهام‌بخش سفر"
                />
                <span>راهنمای سفر</span>
              </div>
              <div>
                <small className="muted">مجله برجیس · ۳ دقیقه مطالعه</small>
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
                <span className="text-link">
                  ادامه داستان <ArrowUpLeft size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="container prefooter">
        <span className="prefooter-icon">
          <Compass size={33} strokeWidth={1.2} />
        </span>
        <div>
          <h3>اولین قدم سفر بعدی را بردارید.</h3>
          <p>کشف کنید، انتخاب کنید و داستان خودتان را بسازید.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/search?product=FLIGHT">
            شروع یک سفر تازه <ArrowUpLeft size={18} />
          </Link>
        </Button>
      </section>
    </>
  );
}
