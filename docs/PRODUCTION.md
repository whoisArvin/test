# Deployment and commercial release gates

The current system is a runnable **DEMO**, not an approved travel-selling service. A successful production build verifies packaging and runtime behavior, not regulatory, supplier, payment or security approval.

## Deploying the sandbox as a Node service

1. Use Node 24 and a supported PostgreSQL 17/Redis 7 service. Use private networking, dedicated database permissions and managed secrets. Do not expose database/Redis ports to the Internet. Local Compose publishes them only on loopback.
2. Set all `.env.example` variables via secure deployment configuration. Generate independent 32-byte PII encryption and webhook keys. Set `APP_URL` to the exact public HTTPS origin; cross-origin writes are rejected. For non-loopback production hosts HTTP origins fail closed. Run behind a TLS reverse proxy and set HSTS there after HTTPS validation.
3. Build, apply SQL migrations once, then start independent web/worker processes:

```bash
npm ci
npm run build
node --env-file=.env dist/migrate.js
# DEMO only; omit when managing a real catalog:
node --env-file=.env dist/seed.js
npm start
# Separate supervised process, same environment:
NODE_ENV=production node --env-file=.env dist/worker.js
```

`npm start` loads Next's `.env` automatically; the standalone worker/migration tools load dotenv or accept `--env-file`. The web and worker must share the same database, Redis, REDIS_NAMESPACE (when set), and cryptographic keys. Set a unique Redis namespace per environment; tests use their own isolated prefix. Processes are not retained by filesystem snapshots. Run with a supervisor and automatic restart. Do not expose a development server in production.

## Docker sandbox deployment

`Dockerfile` builds the web application and bundles worker/migration/seed scripts. The runtime runs as the unprivileged `node` user. `.dockerignore` excludes secrets and development outputs. The image build and runtime validation results are recorded in DELIVERY.md.

```bash
docker compose -f compose.yaml -f compose.production.yaml build app
docker compose -f compose.yaml -f compose.production.yaml up -d --wait postgres redis
docker compose -f compose.yaml -f compose.production.yaml run --rm --no-deps app node dist/migrate.js
# Sandbox catalog only:
docker compose -f compose.yaml -f compose.production.yaml run --rm --no-deps app node dist/seed.js
docker compose -f compose.yaml -f compose.production.yaml up -d app worker
```

In a proxy-managed cloud build, `python3 scripts/docker-build.py berjis:local` forwards only the configured proxy variables by name, resolves that proxy host for BuildKit, and mounts the existing public CA file as an ephemeral build secret. On this cloud machine use `DOCKER_CONFIG=/tmp/berjis-docker` if the default Docker CLI cache directory is read-only. It does not embed proxy credentials or disable certificate/checksum verification. The build forces Prisma's supported client engine type and uses a nonconnecting, credential-free build-time database URL; runtime database settings must still be supplied. The slim image may print Prisma's OpenSSL autodetection warning; this application's query and migration paths use pg/JS/WASM and do not execute a downloaded native Prisma query engine.

Place TLS ingress in front of app port 3000. Provider mode must stay DEMO: setting LIVE deliberately fails rather than selling invented inventory. Review/pin image digests for your release pipeline. The supplied files are a deployment baseline, not a hardened managed database solution.

## Durable jobs, state and operational recovery

PostgreSQL `DurableJob` is the outbox/source of truth. Redis/BullMQ dispatches work. The worker dispatches pending jobs and reclaims expired leases every two seconds; retry backoff reaches 60 seconds, and ten failed attempts enter DEAD. Supplier issuance uses a stable reservation idempotency key. Sandbox issuance and refund are idempotent. Manual tours enter WAITING_MANUAL and are completed only by a role-authorized operator.

Alert on missing worker heartbeat, DEAD jobs, growing queue age, paid/unissued reservations and refund age. Health returns 503 if the heartbeat is older than 15 seconds. The heartbeat establishes a live worker, not that every supplier operation succeeds. Use protected database/operator tools to diagnose DEAD jobs; never mark a document issued by hand or infer issuance from payment success. After diagnosis, requeue through the audited local operator script:

```bash
npx tsx scripts/retry-job.ts <durable-job-id>
```

Do not reset successful provider references or create a second payment to recover issuance. Live adapters must support provider idempotency, verify unknown outcomes by querying the provider, classify retryable transport failures separately from definitive rejection, and reconcile before refunding. The DEMO adapter does not implement those providers' protocols.

## Security boundaries and remaining work

Implemented: opaque hashed sessions, HttpOnly/SameSite cookies, Secure cookies under HTTPS, scrypt passwords, server RBAC/ownership checks, exact-origin CSRF checks, Zod validation, Redis throttling, parameterized database access, authenticated encryption for documents, raw-body payment HMAC, independent provider verification, callback deduplication, server-computed integer money, atomic capacity holds, durable outbox, application audit events, redacted error responses, nonce-based script CSP (development-only unsafe-eval), safe CSV exports, no card-data collection.

Before commercial launch:

- Obtain supplier contracts and API specifications; implement quote/search/reprice/hold/issue/cancel adapters and reconciliation tests. Local DEMO inventory is not a GDS/NDC inventory feed. Different suppliers within one itinerary need an explicit saga and partial-failure policy.
- Integrate a licensed Iranian gateway's real request/redirect/verify/refund protocol; validate rial/toman conversion and fees in its sandbox. Do not reuse the simulated ledger as evidence of a real payment. Obtain webhook secrets securely in the deployment secret manager.
- Add SMS/email delivery adapters, verified signup, password reset, session/device management and administrator MFA. Current login is email/password; OTP and outbound notifications are not available.
- Define age/cabin/baggage/fare rules, timezone-aware flight schedules, hotel room/rate plans, cancellation penalties, ticket numbers/PNR and voucher data from actual providers. The demo flat per-person fare is not a pricing implementation for children/infants.
- Implement commission/settlement/reconciliation ledgers, fiscal invoices, native PDF travel documents, full reporting pagination and data export/retention workflows as required. Current output is a DEMO text document and CSV report.
- Complete banner/page/SEO/media management, licensed accurate photography, real contact/legal/license details, map integration and production content. DEMO indexing is intentionally disabled.
- Enforce request size and connection/time limits at ingress, add WAF/abuse controls with a trusted peer IP policy, managed Redis authentication/TLS, secrets rotation, database least privilege, encrypted backups and external monitoring. Global auth throttling is a sandbox baseline, not a complete abuse/fraud strategy.
- Commission independent security/privacy/legal reviews, load/concurrency tests across multiple application instances, disaster recovery drills and live supplier/payment sandbox certification. Automated checks here are not a penetration test or Core Web Vitals certification.

## Backups and retention

Use daily encrypted PostgreSQL backups plus point-in-time recovery according to business RPO/RTO. Keep Redis persistence for dispatch continuity, but database outbox entries are authoritative. Back up PII encryption keys separately in a secret vault; losing them makes document numbers unrecoverable. Never commit a dump or `.env`. Example of a local sandbox backup (contains personal data if you entered any):

```bash
docker compose exec -T postgres pg_dump -U berjis -d berjis -Fc > berjis-backup.dump
```

Test restore in a separate database/environment before relying on a backup; no destructive restore is performed by setup. No automated backup scheduler or tested restore drill is claimed by this repository. Document retention, deletion requests and legal financial-record retention before collecting real personal data.

## Local container validation

With a DEMO container web server listening on loopback port 3002 and a container worker sharing its database/Redis, run `npx tsx tests/container-smoke.ts http://localhost:3002` from the configured checkout. The script refuses non-loopback or non-DEMO targets, exercises one complete purchase and document download, then removes only its recorded synthetic fixture IDs. It is a functional smoke test, not a live gateway certification. Ensure enough free space before image builds; unused build caches can be reclaimed without deleting database volumes. Do not run destructive volume-pruning commands to free build space.
