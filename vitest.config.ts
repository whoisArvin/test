import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { defineConfig } from 'vitest/config';
const testUrl = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!);
if (!process.env.TEST_DATABASE_URL) testUrl.pathname = '/berjis_test';
if (!testUrl.pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must end in _test');
process.env.DATABASE_URL = testUrl.toString();
process.env.REDIS_NAMESPACE = `berjis-test-${randomUUID()}`;
export default defineConfig({
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
