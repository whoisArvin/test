import { redisNamespace } from '../config';
import { resolveLocation } from '../../lib/locations';
import { db } from '../db';
import { redis } from '../redis';
import { hash } from '../security';
import { assert } from '../errors';
import { searchSchema } from '../validation';
import type { Product } from '@prisma/client';
export const dateOnly = (date: Date | string) =>
  new Date(
    typeof date === 'string'
      ? `${date.slice(0, 10)}T00:00:00.000Z`
      : date.toISOString().slice(0, 10) + 'T00:00:00.000Z'
  );
export const iso = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
export function inventoryDates(product: Product, start: Date, end: Date) {
  if (product !== 'HOTEL') return [start];
  const nights = (end.getTime() - start.getTime()) / 86400000;
  assert(
    Number.isInteger(nights) && nights >= 1 && nights <= 30,
    422,
    'DATES',
    'اقامت باید بین ۱ تا ۳۰ شب باشد.'
  );
  return Array.from({ length: nights }, (_, i) => addDays(start, i));
}
export async function searchOffers(raw: unknown) {
  const input = searchSchema.parse(raw);
  const from = resolveLocation(input.origin),
    to = resolveLocation(input.destination);
  const cacheKey = `${redisNamespace()}:search:${hash(JSON.stringify(input))}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  const start = dateOnly(input.startDate ?? iso(addDays(new Date(), 3)));
  const end = input.endDate
    ? dateOnly(input.endDate)
    : addDays(start, input.product === 'HOTEL' ? 3 : 0);
  const dates = inventoryDates(input.product, start, end);
  const offers = await db.offer.findMany({
    where: {
      product: input.product,
      published: true,
      origin: from.city ? { equals: from.city, mode: 'insensitive' } : undefined,
      AND:
        input.product === 'FLIGHT'
          ? [
              ...(from.code ? [{ details: { path: ['fromCode'], equals: from.code } }] : []),
              ...(to.code ? [{ details: { path: ['toCode'], equals: to.code } }] : []),
              ...(input.flightType
                ? [
                    {
                      details: {
                        path: ['international'],
                        equals: input.flightType === 'international',
                      },
                    },
                  ]
                : []),
            ]
          : undefined,
      OR: to.city
        ? [
            { destination: { contains: to.city, mode: 'insensitive' } },
            { title: { contains: to.city, mode: 'insensitive' } },
          ]
        : undefined,
      inventory: { some: { date: start, available: { gte: input.quantity } } },
    },
    include: { inventory: { where: { date: { in: dates } } } },
    orderBy: { priceIrr: 'asc' },
    take: 100,
  });
  const result = offers
    .filter(
      (o) =>
        o.inventory.length === dates.length &&
        o.inventory.every((i) => i.available >= input.quantity)
    )
    .map((o) => ({
      ...o,
      inventory: undefined,
      available: Math.min(...o.inventory.map((i) => i.available)),
      startDate: iso(start),
      endDate: iso(end),
      totalIrr: o.priceIrr * input.quantity * dates.length,
      demo: true,
    }));
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 20);
  return result;
}
export async function catalog() {
  return db.offer.findMany({
    where: { published: true, product: { in: ['HOTEL', 'TOUR'] } },
    orderBy: { priceIrr: 'desc' },
    take: 12,
  });
}
