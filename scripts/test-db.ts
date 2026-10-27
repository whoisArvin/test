import 'dotenv/config';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
const base = new URL(process.env.DATABASE_URL!);
if (!process.env.TEST_DATABASE_URL && !['localhost', '127.0.0.1'].includes(base.hostname))
  throw new Error('Set an explicit TEST_DATABASE_URL ending in _test for remote databases.');
const target = new URL(process.env.TEST_DATABASE_URL ?? base.toString());
if (!process.env.TEST_DATABASE_URL) target.pathname = '/berjis_test';
const name = target.pathname.slice(1);
if (!/^[a-zA-Z0-9_]+_test$/.test(name))
  throw new Error('Refusing a test database whose name does not end in _test.');
const admin = new URL(target);
admin.pathname = '/postgres';
const c = new pg.Client({ connectionString: admin.toString() });
await c.connect();
try {
  const exists = await c.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
  if (!exists.rowCount) await c.query(`CREATE DATABASE "${name}"`);
} finally {
  await c.end();
}
const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/migrate.ts'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: target.toString() },
});
process.exit(result.status ?? 1);
