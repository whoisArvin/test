import 'dotenv/config';
import { db } from '../src/server/db';
const id = process.argv[2];
if (!id) throw new Error('Usage: npx tsx scripts/retry-job.ts <durable-job-id>');
try {
  await db.$transaction(async (tx) => {
    const job = await tx.durableJob.findUnique({ where: { id } });
    if (!job || job.status !== 'DEAD')
      throw new Error('Only a diagnosed DEAD job may be requeued.');
    await tx.durableJob.update({
      where: { id },
      data: { status: 'PENDING', attempts: 0, availableAt: new Date(), lastError: null },
    });
    await tx.auditLog.create({
      data: {
        actorId: 'local-operator-cli',
        action: 'DEAD_JOB_REQUEUED',
        reservationId: job.reservationId,
        metadata: { jobId: job.id },
      },
    });
  });
  console.log('Job requeued; operator action audited.');
} finally {
  await db.$disconnect();
}
