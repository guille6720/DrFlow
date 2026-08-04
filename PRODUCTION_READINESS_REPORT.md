# Production Readiness Report — DrFlow Enterprise

**Date:** 2026-07-30  
**Version:** 0.2.1  
**Scope:** Docker, CI/CD, health checks, monitoring, logging, backups, disaster recovery, rollback, secrets  
**Environment:** Vercel (`gru1`) + Supabase Postgres (primary) · Docker self-hosted (optional)

---

## Executive summary

| Area | Status | Score |
|------|--------|-------|
| Docker | **Ready** | 9/10 |
| CI/CD | **Ready** | 9/10 |
| Health checks | **Ready** (enhanced) | 9/10 |
| Monitoring | **Partial** | 6/10 |
| Logging | **Ready** | 8/10 |
| Backups | **Partial** | 7/10 |
| Disaster recovery | **Documented** | 7/10 |
| Rollback | **Ready** | 8/10 |
| Secrets management | **Ready** (enhanced) | 8/10 |

**Overall enterprise readiness:** **Ready with gaps** — suitable for production deployment with documented follow-ups for external APM, automated off-site backups, and staging parity.

### Changes in this release

- Split **liveness** (`/api/health/live`) and **readiness** (`/api/health/ready`) probes
- Production env validation at startup (`src/instrumentation.ts`, `src/lib/env.server.ts`)
- `npm run validate:env:production` pre-deploy script
- `/api/health?persist=1` protected with `CRON_SECRET`
- Migration script extended to **030→055**
- [docs/DISASTER_RECOVERY.md](./docs/DISASTER_RECOVERY.md) runbook

---

## 1. Docker

### Current state

| Item | Location | Status |
|------|----------|--------|
| Multi-stage Dockerfile | `Dockerfile` | ✅ Node 24 Alpine, non-root `nextjs` user |
| Standalone output | `next.config.ts` (`DOCKER_BUILD=true`) | ✅ |
| Compose | `docker-compose.yml` | ✅ Port 3000, env file, restart policy |
| Healthcheck | `docker-compose.yml` | ✅ Probes `/api/health/ready` |
| Ignore rules | `.dockerignore` | ✅ |
| npm scripts | `docker:build`, `docker:run` | ✅ |
| CI build | `.github/workflows/ci.yml` | ✅ `docker build` after tests |

### Validation

```powershell
npm run docker:build
npm run docker:run
# En otra terminal:
npm run check:health -- --url=http://127.0.0.1:3000 --strict
```

### Gaps

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| No image registry / tagging strategy | P2 | Push to GHCR or ECR with semver tags |
| Placeholder env at build time | P3 | Acceptable for Next.js; runtime env via `--env-file` |
| No K8s manifests | P3 | Add Helm chart if moving off Vercel |

**Verdict:** ✅ **Production-ready** for self-hosted Next.js; DB remains external (Supabase).

---

## 2. CI/CD

### Current state

| Stage | Workflow | Status |
|-------|----------|--------|
| Lint | `ci.yml` | ✅ ESLint |
| Unit tests | `ci.yml` | ✅ Vitest |
| Coverage gate | `ci.yml` | ✅ 90% core lib |
| Build | `ci.yml` | ✅ Next.js build |
| Smoke health | `ci.yml` | ✅ `next start` + `check:health` |
| Docker build | `ci.yml` | ✅ |
| E2E | `ci.yml` | ✅ Playwright smoke |
| Production uptime | `uptime.yml` | ✅ Every 15 min, `--strict` |
| Vercel deploy | Push to `main` | ✅ (repo-connected) |

### Pre-deploy checklist

```powershell
npm test
npm run build
npm run validate:env:production   # con .env.local de prod en CI secrets o local
npm run check:supabase
npm run check:health -- --url=https://drflow.opusorg.com --strict
```

### Gaps

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| No staging environment gate | P1 | Branch deploy previews + manual promote |
| No `validate:env` in CI | P2 | Add job with GitHub secrets (prod-like) |
| No migration smoke in CI | P2 | Supabase branch DB + `test:rls` against real PG |
| No automated backup workflow | P2 | Scheduled workflow with `DATABASE_URL` secret |

**Verdict:** ✅ **Strong CI**; add staging gate and env validation job for full enterprise tier.

---

## 3. Health checks

### Endpoints

| Endpoint | Purpose | Auth | Expected |
|----------|---------|------|----------|
| `GET /api/health/live` | Liveness — process up | None | Always 200 |
| `GET /api/health/ready` | Readiness — deps + env | None | 200 if ready, 503 if not |
| `GET /api/health` | Full status (legacy/monitors) | None | 200/503 by `ok` |
| `GET /api/health?persist=1` | Persist telemetry event | `Bearer CRON_SECRET` | 401 without auth |
| `GET /api/version` | Release metadata | None | 200 JSON |

### Checks performed (ready + health)

- Supabase REST reachability (latency ms)
- Heap memory (< 512 MB threshold)
- Service role key configured
- Production env completeness (ready only)

### Integrations

| Consumer | Probe | Interval |
|----------|-------|----------|
| Docker Compose | `/api/health/ready` | 60s |
| GitHub Uptime | `/api/health` + `/api/version` | 15 min |
| Vercel Cron | `/api/health?persist=1` | Hourly |
| External (recommended) | `/api/health/ready` | 5 min |

### Script

```powershell
npm run check:health
npm run check:health -- --url=https://drflow.opusorg.com --strict
```

### Gaps

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| Uptime workflow still hits `/api/health` not `/ready` | P3 | Update to `/api/health/ready` for stricter signal |
| No synthetic user journey | P2 | Playwright cron against prod (read-only) |

**Verdict:** ✅ **Enterprise-grade** after live/ready split (this release).

---

## 4. Monitoring

### Current state

| Layer | Implementation | Status |
|-------|----------------|--------|
| App telemetry | `clinic_observability_events` (migration 052) | ✅ |
| Health persistence | Hourly cron → observability table | ✅ |
| Config UI | Configuración → Observabilidad | ✅ |
| Trace IDs | `x-drflow-trace-id` middleware header | ✅ |
| External uptime | GitHub Actions + optional UptimeRobot | ✅ Partial |
| APM (Sentry/Datadog) | `.env.example` comment only | ❌ Not wired |

### Gaps

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| No Sentry/error tracking | **P1** | Add `@sentry/nextjs`, `SENTRY_DSN` in Vercel |
| No metrics dashboard | P2 | Grafana + Supabase metrics or Datadog |
| No alerting on error rate | P1 | Sentry alerts or Better Stack |
| Observability retention | P3 | Purge cron exists (`/api/observability/purge`) |

**Verdict:** ⚠️ **Partial** — internal telemetry is solid; enterprise SLA needs external APM + paging.

---

## 5. Logging

### Current state

| Type | Storage | Immutable | Status |
|------|---------|-----------|--------|
| Security audit | `audit_logs` | ✅ (055) | ✅ |
| Clinical audit | `clinical_record_audit` | ✅ (055) | ✅ |
| App observability | `clinic_observability_events` | No (purge) | ✅ |
| Structured server logs | JSON in observability layer | — | ✅ |
| Vercel logs | Platform | — | ✅ |

Documentation: [AUDIT_LOGGING.md](./AUDIT_LOGGING.md), [SECURITY_REPORT.md](./SECURITY_REPORT.md)

### Audit fields (055)

Who, when, what, old/new values, module, patient, org, IP, user agent — **DELETE/TRUNCATE blocked** on audit tables.

### Gaps

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| No centralized log ship (ELK/Datadog) | P2 | Vercel log drain or Supabase Logflare |
| No log retention policy doc | P3 | Define 90d app / 7y clinical audit |

**Verdict:** ✅ **Strong for healthcare compliance** on audit; ship platform logs for ops.

---

## 6. Backups

### Current state

| Method | Tool | Status |
|--------|------|--------|
| Supabase managed | Dashboard → Backups (Pro plan) | ✅ Recommended |
| Manual logical | `npm run backup:db` → `pg_dump` | ✅ Script ready |
| Output dir | `backups/` (gitignored) | ✅ |
| Storage | Local disk only | ⚠️ |

### Usage

```powershell
# DATABASE_URL in .env.local
npm run backup:db
npm run backup:db -- --out=backups/pre-migration-055.sql
```

### Gaps

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| No automated scheduled backup | **P1** | Weekly GitHub Action → S3/GCS encrypted |
| No backup restore drill | P1 | Quarterly restore to staging (see DR doc) |
| No off-site redundancy | P1 | Copy dumps outside Supabase region |

**Verdict:** ⚠️ **Partial** — tooling exists; enterprise requires automation + off-site + drills.

---

## 7. Disaster recovery

### Documentation

Full runbook: [docs/DISASTER_RECOVERY.md](./docs/DISASTER_RECOVERY.md)

### Targets

| Metric | Target | Notes |
|--------|--------|-------|
| RTO | ≤ 4 h | Vercel rollback ~5 min; DB restore dominates |
| RPO | ≤ 24 h | Supabase daily backup; manual dumps improve RPO |

### Scenarios covered

1. App outage (Vercel/Docker)
2. Database unreachable
3. Failed migration
4. Partial data loss
5. Post-incident checklist

**Verdict:** ✅ **Documented** — execute quarterly drill to validate.

---

## 8. Rollback strategy

### Application

| Platform | Method | Time |
|----------|--------|------|
| Vercel | Promote previous deployment | ~2–5 min |
| Docker | Redeploy previous image/tag | ~5–15 min |
| Git | Tag releases (`v0.2.1`) | Best practice |

### Database

| Strategy | When |
|----------|------|
| **Forward-fix migration** | Preferred — corrective SQL in `supabase/migrations/` |
| Point-in-time restore | Supabase Pro → new project → swap env |
| `pg_dump` restore | Staging only; prod requires maintenance window |

### Do not

- Run destructive down-migrations on production under load
- Delete audit rows (blocked by 055)

**Verdict:** ✅ **Clear app rollback**; DB requires forward-fix discipline.

---

## 9. Secrets management

### Required production secrets

| Secret | Where | Validated by |
|--------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel / Docker env | `validate:env:production`, startup |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel / Docker env | Same |
| `NEXT_PUBLIC_SITE_URL` | Vercel / Docker env | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Same |
| `CRON_SECRET` (≥16 chars) | Server only | Same + cron routes |
| `DATABASE_URL` | Ops / backup only | Warning if missing |

### Protected routes

| Route | Protection |
|-------|------------|
| `/api/jobs/process` | `Bearer CRON_SECRET` |
| `/api/observability/purge` | `Bearer CRON_SECRET` |
| `/api/health?persist=1` | `Bearer CRON_SECRET` (this release) |

Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` when the env var is set.

### Scripts

```powershell
npm run validate:env              # dev — no strict check
npm run validate:env:production   # fails if secrets missing
```

Startup: `src/instrumentation.ts` throws in production if env incomplete.

### Gaps

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| No secret rotation runbook | P2 | Document 90-day CRON_SECRET rotation |
| No Vault/AWS SM | P3 | Optional for multi-region enterprise |
| `.env.local` in dev | — | Never commit; `.env.example` is template only |

**Verdict:** ✅ **Production-ready** with validation; rotation process recommended.

---

## 10. Database migrations (production)

| Item | Status |
|------|--------|
| Migration files | 001–055 (+ seed variants) |
| Production script | `npm run migrate:production-pending` (030→055) |
| Security fixes | 053 applied |
| Performance / FK | 054 applied |
| Immutable audit | 055 applied |

```powershell
$env:DATABASE_URL="postgresql://..."
npm run migrate:production-pending
npm run check:supabase
```

---

## 11. Related reports

| Report | Focus |
|--------|-------|
| [SECURITY_REPORT.md](./SECURITY_REPORT.md) | Auth/authz audit |
| [DATABASE_REPORT.md](./DATABASE_REPORT.md) | Postgres performance |
| [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) | App profiling |
| [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) | Immutable audit |
| [docs/PRODUCTION.md](./docs/PRODUCTION.md) | Ops runbook |
| [docs/ENTERPRISE_HARDENING.md](./docs/ENTERPRISE_HARDENING.md) | Hardening v1.0 |

---

## 12. Enterprise action plan (prioritized)

### P0 — Before enterprise SLA

- [ ] Confirm Supabase **Pro** backups enabled
- [ ] Set `CRON_SECRET` in Vercel (≥16 chars)
- [ ] Run `npm run validate:env:production` against prod secrets
- [ ] Confirm migrations **055** applied in production

### P1 — Next 30 days

- [ ] Integrate **Sentry** (`SENTRY_DSN`) for error tracking + alerts
- [ ] Scheduled **off-site backup** (GitHub Action → encrypted S3)
- [ ] **Quarterly DR drill** (restore to staging)
- [ ] Staging environment with preview DB branch

### P2 — Next 90 days

- [ ] Add `validate:env:production` to CI with secrets
- [ ] Uptime monitor on `/api/health/ready` (Better Stack / UptimeRobot)
- [ ] Log drain (Vercel → Datadog/Logflare)
- [ ] Container registry + semver tags for Docker

### P3 — Optional

- [ ] K8s/Helm manifests
- [ ] HashiCorp Vault for secrets
- [ ] Synthetic E2E against production (read-only)

---

## 13. Sign-off checklist

Use before declaring **Enterprise Production Ready**:

```
[ ] npm test && npm run build — green
[ ] npm run check:health -- --url=<PROD_URL> --strict — green
[ ] npm run validate:env:production — green
[ ] /api/health/live → 200
[ ] /api/health/ready → 200, ok: true
[ ] /api/health?persist=1 without auth → 401
[ ] Supabase backups verified in dashboard
[ ] CRON_SECRET set; cron jobs running (jobs, health persist, purge)
[ ] Migrations through 055 applied
[ ] DR runbook reviewed by on-call
[ ] SECURITY_REPORT P0/P1 items closed
```

---

*Generated for DrFlow enterprise deployment validation. For questions, see [docs/PRODUCTION.md](./docs/PRODUCTION.md) and [docs/DISASTER_RECOVERY.md](./docs/DISASTER_RECOVERY.md).*
