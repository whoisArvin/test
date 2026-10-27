#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  node --input-type=module <<'NODE'
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const password=randomBytes(24).toString('hex');
writeFileSync('.env',`POSTGRES_PASSWORD=${password}\nDATABASE_URL=postgresql://berjis:${password}@127.0.0.1:5432/berjis?schema=public\nREDIS_URL=redis://127.0.0.1:6379\nAPP_URL=http://localhost:3000\nPII_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nPAYMENT_WEBHOOK_SECRET=${randomBytes(32).toString('hex')}\nPROVIDER_MODE=DEMO\n`,{mode:0o600,flag:'wx'});
NODE
fi
npm ci
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
