import {
  createCipheriv,
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHmac,
} from 'node:crypto';
import { promisify } from 'node:util';
import { required, appUrl } from './config';
import { assert } from './errors';
import { db } from './db';
import type { Role } from '@prisma/client';
const scrypt = promisify(scryptCallback);
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function passwordMatches(password: string, saved: string) {
  const [salt, value] = saved.split(':');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const stored = Buffer.from(value, 'hex');
  return stored.length === key.length && timingSafeEqual(stored, key);
}
export function encryptPii(plain: string) {
  const key = Buffer.from(required('PII_ENCRYPTION_KEY'), 'hex');
  assert(key.length === 32, 500, 'CONFIG', 'تنظیمات رمزگذاری کامل نیست.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), ciphertext.toString('hex')].join(
    '.'
  );
}
export function signature(raw: string) {
  return createHmac('sha256', required('PAYMENT_WEBHOOK_SECRET')).update(raw).digest('hex');
}
export function verifySignature(raw: string, supplied: string) {
  const expected = Buffer.from(signature(raw), 'hex');
  const candidate = Buffer.from(supplied, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  assert(origin === appUrl().origin, 403, 'CSRF', 'مبدأ درخواست معتبر نیست.');
  assert(
    request.headers.get('content-type')?.startsWith('application/json'),
    415,
    'CONTENT_TYPE',
    'درخواست باید JSON باشد.'
  );
}
export async function sessionUser(request: Request) {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('berjis_session='))
    ?.slice(15);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.session.findUnique({
    where: { id: hash(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { id, name, email, role } = session.user;
  return { id, name, email, role };
}
export async function requireUser(request: Request) {
  const user = await sessionUser(request);
  assert(user, 401, 'UNAUTHENTICATED', 'برای ادامه وارد حساب خود شوید.');
  return user;
}
export type SessionUser = NonNullable<Awaited<ReturnType<typeof sessionUser>>>;
const permissions: Record<Role, string[]> = {
  CUSTOMER: [],
  SUPPORT: ['orders:read', 'support:write'],
  BOOKING_AGENT: ['orders:read', 'orders:write'],
  SALES_MANAGER: ['orders:read', 'catalog:write', 'analytics:read'],
  ACCOUNTANT: ['finance:read', 'refund:write'],
  SUPER_ADMIN: [
    'orders:read',
    'orders:write',
    'support:write',
    'catalog:write',
    'analytics:read',
    'finance:read',
    'refund:write',
    'users:write',
    'audit:read',
    'content:write',
  ],
};
export function authorize(user: SessionUser, permission: string) {
  assert(
    permissions[user.role].includes(permission),
    403,
    'FORBIDDEN',
    'به این بخش دسترسی ندارید.'
  );
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await db.session.create({
    data: { id: hash(token), userId, expiresAt: new Date(Date.now() + 7 * 86400000) },
  });
  return `berjis_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${appUrl().protocol === 'https:' ? '; Secure' : ''}`;
}
