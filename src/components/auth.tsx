'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { post, useApp } from './providers';
import { Button } from './ui/button';
const schema = z.object({
  email: z.email('ایمیل معتبر وارد کنید.'),
  password: z.string().min(12, 'رمز عبور باید حداقل ۱۲ نویسه باشد.').max(128),
  name: z.string().max(80).optional(),
});
export function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login'),
    [error, setError] = useState('');
  const { refresh } = useApp(),
    router = useRouter(),
    params = useSearchParams();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async (input) => {
    setError('');
    try {
      await post(`auth/${mode}`, input);
      await refresh();
      const to = params.get('next') ?? '/account';
      router.push(to.startsWith('/') && !to.startsWith('//') ? to : '/account');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ارتباط');
    }
  });
  return (
    <div className="container">
      <div className="auth-wrap">
        <div className="auth-form">
          <span className="eyebrow">سفر بعدی از اینجا شروع می‌شود</span>
          <h1>{mode === 'login' ? 'به برجیس خوش آمدید' : 'یک حساب، هزار مقصد'}</h1>
          <p>
            {mode === 'login'
              ? 'برای مدیریت سفرها، وارد حساب خود شوید.'
              : 'حساب خود را بسازید و سفر بعدی را برنامه‌ریزی کنید.'}
          </p>
          <form onSubmit={submit}>
            {mode === 'register' && (
              <label className="form-label">
                نام و نام خانوادگی
                <input autoComplete="name" {...register('name')} required minLength={2} />
              </label>
            )}
            <label className="form-label">
              ایمیل
              <input type="email" dir="ltr" autoComplete="email" {...register('email')} />
              {errors.email && <span className="form-error">{errors.email.message}</span>}
            </label>
            <label className="form-label">
              رمز عبور
              <input
                type="password"
                dir="ltr"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                {...register('password')}
              />
              {errors.password && <span className="form-error">{errors.password.message}</span>}
            </label>
            {error && (
              <div className="inline-error" style={{ marginTop: 20 }} role="alert">
                {error}
              </div>
            )}
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting
                ? 'در حال بررسی…'
                : mode === 'login'
                  ? 'ورود به حساب'
                  : 'ساخت حساب کاربری'}
              <ArrowLeft size={17} />
            </Button>
          </form>
          <div className="auth-switch">
            {mode === 'login' ? 'هنوز حساب ندارید؟' : 'قبلاً ثبت‌نام کرده‌اید؟'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
            >
              {mode === 'login' ? 'ثبت‌نام کنید' : 'وارد شوید'}
            </button>
          </div>
          <div className="notice-box">
            <ShieldCheck size={15} style={{ display: 'inline', marginLeft: 5 }} />
            محیط DEMO؛ لطفاً از اطلاعات و مدارک آزمایشی استفاده کنید. ورود پیامکی تا اتصال سرویس
            پیامک فعال نیست.
          </div>
        </div>
        <div className="auth-art">
          <Image src="/images/travel-hero.jpg" fill sizes="50vw" alt="ساحل مدیترانه" />
          <div>
            <span className="eyebrow">BERJIS TRAVEL</span>
            <h2>
              جهان بزرگ‌تر از آن است
              <br />
              که فقط یک گوشه‌اش را ببینیم.
            </h2>
            <p>
              همراه شما، از اولین رؤیای سفر
              <br />
              تا آخرین خاطره مسیر.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
