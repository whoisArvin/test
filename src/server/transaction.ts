import { Prisma } from '@prisma/client';
import { db } from './db';

function isRetryable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (['P2034', 'P2002'].includes(error.code)) return true;
    if (error.code !== 'P2010') return false;
    const meta = error.meta as
      | { code?: string; driverAdapterError?: { cause?: { originalCode?: string; code?: string } } }
      | undefined;
    const state =
      meta?.code ??
      meta?.driverAdapterError?.cause?.originalCode ??
      meta?.driverAdapterError?.cause?.code;
    return state === '40001' || state === '40P01';
  }
  // The JS driver adapter can expose SQLSTATE directly instead of wrapping it in P2034.
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'DriverAdapterError' &&
    'cause' in error
  ) {
    const cause = error.cause;
    if (cause && typeof cause === 'object') {
      const code =
        'originalCode' in cause ? cause.originalCode : 'code' in cause ? cause.code : null;
      return code === '40001' || code === '40P01';
    }
  }
  return false;
}

/** Use only for database-only callbacks. Never put a non-idempotent external side effect here. */
export async function serializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: 'Serializable',
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (error) {
      if (!isRetryable(error) || attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1) + Math.random() * 40));
    }
  }
}

/** Existing-order mutations lock the reservation before touching payment/inventory child rows. */
export async function lockReservation(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Reservation" WHERE "id" = ${id} FOR UPDATE`;
}
