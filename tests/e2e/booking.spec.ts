import { cleanupFixtures } from '../helpers/fixtures';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/server/db';
const origin = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const password = 'E2E-demo-passphrase-2026!';
const createdUsers: string[] = [];
const createdOffers: string[] = [];
test.beforeAll(() => {
  expect(process.env.PROVIDER_MODE).toBe('DEMO');
});
async function signup(request: APIRequestContext, admin = false) {
  const email = `browser-${randomUUID()}@example.test`;
  const res = await request.post('/api/v1/auth/register', {
    headers: { Origin: origin },
    data: { email, password, name: 'مسافر آزمایشی' },
  });
  expect(res.ok()).toBeTruthy();
  const { user } = await res.json();
  createdUsers.push(user.id);
  if (admin) await db.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } });
  return user;
}
async function passengers(page: Page) {
  await page.getByRole('textbox', { name: 'نام مطابق مدرک' }).fill('Demo');
  await page.getByRole('textbox', { name: 'نام خانوادگی', exact: true }).fill('Traveler');
  await page.getByRole('textbox', { name: 'شماره مدرک آزمایشی' }).fill('DEMO123456');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'ثبت رزرو و ورود به پرداخت آزمایشی' }).click();
  await expect(page.getByRole('heading', { name: 'شبیه‌ساز پرداخت' })).toBeVisible();
}
async function searchAndSelect(page: Page, product: string, destination: string) {
  const start = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    end = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  await page.goto(
    `/search?product=${product}&origin=${encodeURIComponent('تهران')}&destination=${encodeURIComponent(destination)}&startDate=${start}&endDate=${end}&quantity=1`
  );
  await page
    .getByRole('button', {
      name:
        product === 'FLIGHT' ? 'انتخاب پرواز' : product === 'HOTEL' ? 'انتخاب هتل' : 'انتخاب تور',
      exact: true,
    })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'اطلاعات مسافران و بررسی سفارش' })).toBeVisible();
}
test.afterAll(async () => {
  await cleanupFixtures(createdUsers, createdOffers);
  await db.$disconnect();
});
test('home, Persian calendar and responsive navigation work without browser errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('داستان تازه');
  await page.getByRole('button', { name: 'تاریخ رفت', exact: true }).click();
  await expect(page.getByRole('grid')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'برای سفر بعدی، الهام بگیرید' }).scrollIntoViewIfNeeded();
  await expect(page.locator('.travel-card')).toHaveCount(3);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: 'test-results/berjis-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'باز و بسته کردن فهرست' }).click();
  await expect(page.getByRole('navigation', { name: 'منوی اصلی' })).toBeVisible();
  await page.getByRole('button', { name: 'باز و بسته کردن فهرست' }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/berjis-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('registration UI preserves the selected trip and completes a flight purchase', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'جستجو', exact: true }).click();
  await page.getByRole('button', { name: 'انتخاب پرواز', exact: true }).first().click();
  await page.getByRole('link', { name: 'ورود یا ثبت‌نام', exact: true }).click();
  await page.getByRole('button', { name: 'ثبت‌نام کنید' }).click();
  await page.getByRole('textbox', { name: 'نام و نام خانوادگی' }).fill('مسافر تست');
  const registeredEmail = `signup-${randomUUID()}@example.test`;
  await page.getByRole('textbox', { name: 'ایمیل', exact: true }).fill(registeredEmail);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ساخت حساب کاربری' }).click();
  await expect(page.getByRole('heading', { name: 'اطلاعات مسافران و بررسی سفارش' })).toBeVisible();
  const registeredUser = await db.user.findUnique({ where: { email: registeredEmail } });
  if (registeredUser) createdUsers.push(registeredUser.id);
  await passengers(page);
  await page.getByRole('button', { name: 'پرداخت موفق آزمایشی', exact: true }).click();
  await expect(page.getByText('سند آزمایشی صادر شده است', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'دریافت سند DEMO' }).click();
  expect((await download).suggestedFilename()).toContain('DEMO');
  await page.goto('/account');
  await expect(page.locator('.order-card')).toHaveCount(1);
  await page.goto('/account?tab=notifications');
  await expect(
    page.getByRole('heading', { name: 'سند DEMO پس از تأیید تأمین‌کننده صادر شد' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'علامت‌گذاری همه به‌عنوان خوانده‌شده' }).click();
  await expect(page.getByText('جدید', { exact: true })).toHaveCount(0);
});
for (const [product, destination] of [
  ['HOTEL', 'کیش'],
  ['TOUR', 'استانبول'],
])
  test(`${product} purchase reaches supplier-confirmed DEMO issuance`, async ({
    page,
    request,
  }) => {
    await signup(page.request);
    await searchAndSelect(page, product, destination);
    await passengers(page);
    await page.getByRole('button', { name: 'پرداخت موفق آزمایشی', exact: true }).click();
    await expect(page.getByText('سند آزمایشی صادر شده است', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'دریافت سند DEMO' })).toBeVisible();
  });
test('round-trip selection holds both legs in one order', async ({ page, request }) => {
  await signup(page.request);
  await page.goto('/');
  await page.getByRole('combobox', { name: 'نوع سفر' }).selectOption('roundtrip');
  await page.getByRole('button', { name: 'جستجو', exact: true }).click();
  await page.getByRole('button', { name: 'انتخاب پرواز', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('کیش به تهران');
  await page.getByRole('button', { name: 'انتخاب پرواز', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'خلاصه سفر شما' })).toBeVisible();
  await passengers(page);
  await page.getByRole('button', { name: 'پرداخت موفق آزمایشی', exact: true }).click();
  await expect(page.getByText('سند آزمایشی صادر شده است', { exact: true })).toBeVisible();
  await expect(page.locator('.panel .summary-line')).toHaveCount(2);
});
test('successful payment with rejected issuance never shows a confirmed travel document', async ({
  page,
  request,
}) => {
  await signup(page.request);
  await searchAndSelect(page, 'FLIGHT', 'مشهد');
  await passengers(page);
  await page.getByRole('button', { name: 'پرداخت موفق، شکست صدور', exact: true }).click();
  await expect(page.locator('.order-state-grid')).toContainText(
    /استرداد آزمایشی انجام شد|در انتظار استرداد/
  );
  await expect(page.getByRole('link', { name: 'دریافت سند DEMO' })).toHaveCount(0);
});
test('customer cannot enter admin; admin can edit a tour and export finance', async ({
  page,
  request,
}) => {
  await signup(page.request);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'دسترسی مدیریتی لازم است' })).toBeVisible();
  expect((await page.request.get('/api/v1/admin/overview')).status()).toBe(403);
  await signup(page.request, true);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'فضای مدیریت برجیس' })).toBeVisible();
  await page.getByRole('button', { name: 'مدیریت تور', exact: true }).click();
  await page.getByRole('button', { name: 'ایجاد تور' }).click();
  const tourTitle = `تور آزمایشی تست مرورگر ${randomUUID().slice(0, 8)}`;
  await page.getByRole('textbox', { name: 'عنوان', exact: true }).fill(tourTitle);
  await page
    .getByRole('textbox', { name: 'زیرعنوان', exact: true })
    .fill('بررسی انتشار و مدیریت ظرفیت');
  await page.getByRole('textbox', { name: 'مقصد', exact: true }).fill('شیراز');
  await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
  await expect(page.getByRole('cell', { name: tourTitle, exact: true })).toBeVisible();
  const createdTour = await db.offer.findFirst({ where: { title: tourTitle } });
  if (createdTour) createdOffers.push(createdTour.id);
  await page.getByRole('button', { name: 'گزارش مالی', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'دریافت CSV مالی DEMO' }).click();
  expect((await download).suggestedFilename()).toContain('finance.csv');
});
test('public information pages and journal routes are usable', async ({ page }) => {
  for (const route of [
    '/about',
    '/contact',
    '/faq',
    '/terms',
    '/visa',
    '/journal',
    '/journal/istanbul-guide',
  ]) {
    const res = await page.goto(route);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
  }
  await page.goto('/faq');
  await page.getByText('رزرو موقت چقدر اعتبار دارد؟', { exact: true }).click();
  await expect(page.getByText('۱۵ دقیقه. اگر در این مدت', { exact: false })).toBeVisible();
});

test('customer traveler and support tools persist data', async ({ page }) => {
  await signup(page.request);
  await page.goto('/account?tab=travelers');
  await page.getByRole('button', { name: 'افزودن مسافر آزمایشی' }).click();
  await page.getByRole('textbox', { name: 'نام', exact: true }).fill('Demo');
  await page.getByRole('textbox', { name: 'نام خانوادگی', exact: true }).fill('Saved');
  await page.getByLabel('تاریخ تولد میلادی').fill('1990-01-01');
  await page.getByRole('textbox', { name: 'شماره مدرک آزمایشی' }).fill('DEMO123456');
  await page.getByRole('button', { name: 'ذخیره مسافر' }).click();
  await expect(page.getByRole('cell', { name: 'Demo Saved' })).toBeVisible();
  await page.getByRole('button', { name: 'حذف', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Demo Saved' })).toHaveCount(0);
  await page.goto('/account?tab=support');
  await page.getByRole('textbox', { name: 'موضوع', exact: true }).fill('بررسی سفارش آزمایشی');
  await page
    .getByRole('textbox', { name: 'پیام شما' })
    .fill('این پیام برای بررسی عملکرد واقعی ثبت تیکت آزمایشی است.');
  await page.getByRole('button', { name: 'ثبت تیکت', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'بررسی سفارش آزمایشی' })).toBeVisible();
});

test('home, search and login pass automated WCAG checks', async ({ page }) => {
  for (const route of ['/', '/search?product=FLIGHT', '/login']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    if (route === '/search?product=FLIGHT') {
      await expect(page.locator('nav.nav a.active')).toHaveCount(1);
      await expect(page.locator('nav.nav a.active')).toHaveText('بلیط هواپیما');
    }
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
    });
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(scan.violations, route).toEqual([]);
  }
});
