import { redisNamespace } from './config';
import { hash } from './security';
import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { db } from './db';
import { expireHolds } from './services/reservations';
import { fulfilReservation, settleRefund } from './services/fulfilment';
const url = new URL(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
const connection = {
  host: url.hostname,
  port: Number(url.port || 6379),
  password: url.password || undefined,
  username: url.username || undefined,
  tls: url.protocol === 'rediss:' ? {} : undefined,
};
const queueName = `berjis-${hash(redisNamespace()).slice(0, 12)}-work`;
const queue = new Queue(queueName, { connection });
const worker = new Worker(
  queueName,
  async (job) => {
    const j = await db.durableJob.findUnique({ where: { id: job.data.durableJobId } });
    if (!j || ['DONE', 'WAITING_MANUAL', 'DEAD'].includes(j.status)) return;
    const claimed = await db.durableJob.updateMany({
      where: {
        id: j.id,
        OR: [{ status: 'PENDING' }, { status: 'RUNNING', availableAt: { lt: new Date() } }],
      },
      data: {
        status: 'RUNNING',
        availableAt: new Date(Date.now() + 120000),
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) return;
    try {
      if (j.kind === 'ISSUE') await fulfilReservation(j.reservationId);
      else if (j.kind === 'REFUND') await settleRefund(j.reservationId);
      await db.durableJob.updateMany({
        where: { id: j.id, status: 'RUNNING' },
        data: { status: 'DONE', lastError: null },
      });
    } catch {
      await db.durableJob.update({
        where: { id: j.id },
        data: {
          status: j.attempts >= 9 ? 'DEAD' : 'PENDING',
          lastError: 'Job failed; review protected server logs',
          availableAt: new Date(Date.now() + Math.min(60000, 2 ** j.attempts * 1000)),
        },
      });
      console.error(JSON.stringify({ event: 'job_failed', jobId: j.id, attempt: j.attempts + 1 }));
    }
  },
  { connection, concurrency: 4 }
);
worker.on('error', () => console.error(JSON.stringify({ event: 'worker_connection_error' })));
let pumping = false;
async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    await expireHolds();
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.systemSetting.upsert({
      where: { key: 'worker-heartbeat' },
      create: { key: 'worker-heartbeat', value: { at: new Date().toISOString() } },
      update: { value: { at: new Date().toISOString() } },
    });
    const jobs = await db.durableJob.findMany({
      where: {
        OR: [
          { status: 'PENDING', availableAt: { lte: new Date() } },
          { status: 'RUNNING', availableAt: { lt: new Date() } },
        ],
      },
      take: 50,
    });
    for (const job of jobs)
      await queue.add(
        job.kind,
        { durableJobId: job.id },
        { jobId: `${job.id}-${job.attempts}`, removeOnComplete: true, removeOnFail: 100 }
      );
  } catch {
    console.error(JSON.stringify({ event: 'outbox_dispatch_failed' }));
  } finally {
    pumping = false;
  }
}
const timer = setInterval(pump, 2000);
void pump();
console.log('BERJIS DEMO worker started: durable outbox + hold expiry');
async function shutdown() {
  clearInterval(timer);
  await worker.close();
  await queue.close();
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
