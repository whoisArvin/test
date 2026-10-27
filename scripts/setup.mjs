import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
if (!existsSync('.env')) {
  const password = randomBytes(24).toString('hex');
  writeFileSync('.env', [
    `POSTGRES_PASSWORD=${password}`,
    `DATABASE_URL=postgresql://berjis:${password}@127.0.0.1:5432/berjis?schema=public`,
    'REDIS_URL=redis://127.0.0.1:6379',
    'APP_URL=http://localhost:3000',
    `PII_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`,
    `PAYMENT_WEBHOOK_SECRET=${randomBytes(32).toString('hex')}`,
    'PROVIDER_MODE=DEMO', '',
  ].join('\n'), {mode:0o600,flag:'wx'});
}
for (const [command, ...args] of [
  ['npm','ci'],
  ['docker','compose','up','-d','--wait'],
  ['npm','run','db:generate'],
  ['npm','run','db:migrate'],
  ['npm','run','db:seed'],
]) {
  // Windows npm.cmd needs cmd.exe; all commands and arguments here are fixed.
  const result = spawnSync(command, args, {stdio:'inherit',shell:process.platform==='win32'});
  if (result.error) console.error(`Cannot start ${command}: ${result.error.code}`);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
