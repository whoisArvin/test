/** Transactional SQL migration runner for network-restricted builds.
 * Uses Prisma-generated, reviewed SQL and the standard Prisma migration ledger.
 * Does not require native Prisma schema-engine downloads. */
import 'dotenv/config';
import pg from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('SELECT pg_advisory_lock(846201727)');
  await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMPTZ, migration_name VARCHAR(255) NOT NULL,
    logs TEXT, rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  )`);
  const names = (await readdir('prisma/migrations', { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const name of names) {
    const sql = await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const prior = await client.query(
      'SELECT checksum, finished_at FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL',
      [name]
    );
    if (prior.rowCount) {
      if (prior.rows[0].checksum !== checksum || !prior.rows[0].finished_at)
        throw new Error(`Migration checksum or state conflict: ${name}`);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO "_prisma_migrations" (id,checksum,migration_name,finished_at,applied_steps_count) VALUES ($1,$2,$3,now(),1)',
        [randomUUID(), checksum, name]
      );
      await client.query('COMMIT');
      console.log(`Applied ${name}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }
  console.log('Database migrations are up to date.');
} finally {
  await client.query('SELECT pg_advisory_unlock(846201727)');
  await client.end();
}
