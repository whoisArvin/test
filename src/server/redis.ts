import { redisNamespace } from './config';
import Redis from 'ioredis';
import { assert } from './errors';
import { hash } from './security';
const globalRedis = globalThis as unknown as { redis?: Redis };
export const redis =
  globalRedis.redis ??
  new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });
if (process.env.NODE_ENV !== 'production') globalRedis.redis = redis;
export async function rateLimit(key: string, limit = 60, seconds = 60) {
  const count = await redis.eval(
    `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`,
    1,
    `${redisNamespace()}:rate:${hash(key)}`,
    seconds
  );
  assert(Number(count) <= limit, 429, 'RATE_LIMIT', 'درخواست‌های زیادی فرستاده‌اید. کمی صبر کنید.');
}
