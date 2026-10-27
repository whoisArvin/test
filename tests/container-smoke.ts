import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { db } from '../src/server/db';
import { cleanupFixtures } from './helpers/fixtures';
const base = process.argv[2] ?? 'http://localhost:3002';
assert(
  ['localhost', '127.0.0.1'].includes(new URL(base).hostname),
  'Smoke test is restricted to local DEMO instances.'
);
assert.equal(process.env.PROVIDER_MODE, 'DEMO');
let cookie = '';
let userId: string | undefined;
async function call(path: string, body?: unknown, extra: Record<string, string> = {}) {
  const response = await fetch(`${base}/api/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json', Cookie: cookie, ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert(response.ok, `Smoke API failed: ${path} (${response.status})`);
  return response;
}
try {
  const health = await (await call('health')).json();
  assert.equal(health.worker, 'ok');
  const registered = await call('auth/register', {
    name: 'Container smoke fixture',
    email: `container-${randomUUID()}@example.test`,
    password: randomBytes(24).toString('hex'),
  });
  cookie = registered.headers.get('set-cookie')!.split(';')[0];
  userId = (await registered.json()).user.id;
  const start = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const q = new URLSearchParams({
    product: 'FLIGHT',
    origin: 'تهران',
    destination: 'کیش',
    startDate: start,
    endDate: start,
    quantity: '1',
  });
  const offers = (await (await call(`search?${q}`)).json()).offers;
  assert(offers.length > 0);
  const order = await (
    await call(
      'orders',
      {
        items: [{ offerId: offers[0].id, startDate: start, endDate: start, quantity: 1 }],
        passengers: [
          {
            firstName: 'Container',
            lastName: 'Demo',
            birthDate: '1990-01-01',
            documentNumber: 'DEMO123456',
          },
        ],
        expectedTotalIrr: offers[0].priceIrr,
      },
      { 'Idempotency-Key': randomUUID() }
    )
  ).json();
  const payment = await (await call(`orders/${order.id}/payments`, {})).json();
  await call(`payments/${payment.id}/simulate`, { outcome: 'SUCCESS' });
  let saved;
  for (let attempt = 0; attempt < 40; attempt++) {
    saved = await (await call(`orders/${order.id}`)).json();
    if (saved.fulfilmentStatus === 'ISSUED') break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(saved.status, 'CONFIRMED');
  assert.equal(saved.paymentStatus, 'PAID');
  assert.equal(saved.document.demo, true);
  const document = await call(`orders/${order.id}/receipt`);
  assert((await document.text()).includes('DEMO'));
  console.log(
    JSON.stringify({
      containerWeb: 'ok',
      postgres: 'ok',
      redis: 'ok',
      containerWorker: 'ok',
      demoPurchase: 'confirmed',
      document: 'DEMO only',
    })
  );
} finally {
  if (userId) await cleanupFixtures([userId]);
  await db.$disconnect();
}
