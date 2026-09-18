# Phase 5 — Disaster Recovery + Operational Alerting

**Repository:** [guille6720/DrFlow](https://github.com/guille6720/DrFlow)  
**Branch:** `release/0.2.19-staging-promotion`  
**Scope:** Staging-only; production (`nipqdarduknydqptqzup`) not modified  
**Report date:** 2026-08-28  
**References:** [PHASE-1-BASELINE.md](./PHASE-1-BASELINE.md), [DATABASE-SCALE-REPORT.md](./DATABASE-SCALE-REPORT.md), [PHASE-3-TENANT-ISOLATION.md](./PHASE-3-TENANT-ISOLATION.md), [PHASE-4-OBSERVABILITY-SLO.md](./PHASE-4-OBSERVABILITY-SLO.md), [../DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md)

---

## Executive summary

Phase 5 implements staging disaster-recovery tooling, operational alert dispatch, migration destructive-SQL guardrails, and a **non-destructive** staging recovery drill with machine-readable evidence. **BL-P0-2 remains OPEN** because **actual measured RPO ≈ 24 h** (daily managed backup bound) — PITR is **not verified** in the Supabase dashboard and no destructive restore was performed in-place on active staging.

| Exit criterion | Status |
|----------------|--------|
| Backup capability audited | ✅ `coverage/phase5-backup-audit.json` |
| Actual RPO measured (not estimated) | ✅ **24 h — FAIL** (target ≤ 1 h) |
| Actual RTO measured | ⚠️ **0.14 min validation pipeline only** — full DB restore RTO **not measured** |
| Post-restore clinical integrity proven | ✅ Synthetic fixture + checksum validation |
| Tenant isolation survives validation | ✅ Phase 3 fixtures re-checked |
| Audit trail consistent | ✅ `audit_logs` event present |
| Storage recovery gap understood | ✅ P1 gap — metadata without object |
| Secrets recovery documented | ✅ Checklist below (names only) |
| Operational alerts wired | ✅ `ops-alert.ts` + health/error hooks |
| Sentry staging verified | ⚠️ Script ready; DSN/`DRFLOW_SENTRY_STAGING=1` env-dependent |
| No new security regression | ✅ Security gate + RLS static green |
| **BL-P0-2** | **OPEN / NO-GO** |

**Phase 5 verdict:** **NO-GO** for Phase 6 until PITR is enabled and a **timed restore to an isolated project** proves RPO ≤ 1 h.

---

## 1. Recovery objectives (initial targets — not PASS until tested)

| Metric | Target | Test status |
|--------|--------|-------------|
| **RPO** | ≤ **1 hour** | **FAIL** — measured **~24 h** (daily backup bound) |
| **RTO** | ≤ **2 hours** | **Partial** — validation pipeline **0.14 min**; **full restore RTO not measured** |

### Definitions

| Term | Definition |
|------|------------|
| **Recovery Point Objective (RPO)** | Maximum acceptable data loss window. Measured as `incident_timestamp − latest_recoverable_timestamp`. |
| **Recovery Time Objective (RTO)** | Maximum acceptable time from recovery start until DB accessible, app healthy, readiness PASS, and critical clinical read works. |
| **Data-loss tolerance** | Synthetic Phase 5 fixture + audit rows; zero tolerance for cross-tenant leakage post-recovery. |
| **Service-restoration sequence** | (1) Declare incident → (2) Restore DB to **new/isolated** project via Supabase backup/PITR → (3) Repoint staging env vars → (4) Redeploy/rollback Vercel → (5) Run `validate-recovery-integrity.mjs` → (6) Re-run tenant isolation probes |

---

## 2. Backup inventory

| Source | Frequency | Retention | Restore mechanism | Prerequisites | Limitations |
|--------|-----------|-----------|-------------------|---------------|-------------|
| **Supabase managed daily** | Daily (platform) | Plan-dependent (~7 d Pro) | Dashboard → restore / PITR | Org access, billing | **RPO ~24 h without PITR** |
| **`scripts/backup-supabase.mjs`** | Manual on-demand | Local disk | `pg_restore` / psql to **new** DB | `DATABASE_URL`, pg_dump | Not scheduled in CI; **not configured locally** during drill |
| **Vercel rollback** | Per deploy | Deployment history | Promote prior deployment | Vercel access | App-only; does not restore Postgres |
| **Git / migrations** | Per commit | Full history | Checkout + forward migrations | Repo access | Forward-only; see §8 |
| **Audit logs** | Continuous INSERT | With Postgres backup | Restored with DB | — | Immutability triggers preserved in migrations |

Evidence: `coverage/phase5-backup-audit.json`

---

## 3. PITR status

| Check | Result |
|-------|--------|
| Staging project | `gprmsufvhabntbrytwyi` (DrFlow-Staging) |
| `wal_level` | `logical` |
| `archive_mode` | `on` |
| **PITR confirmed in dashboard** | **No** — `not_verified_in_dashboard` |
| Latest recoverable timestamp | **Not recorded** — requires dashboard operator action |

### Required manual action (infra)

1. Supabase Dashboard → **DrFlow-Staging** → Database → **Backups**
2. Enable **Point in Time Recovery** if plan supports it
3. Record retention window and **latest recoverable timestamp**
4. Restore to a **new temporary project** (never overwrite active staging)
5. Re-run `npm run phase5:dr:drill` against restored project with `DATABASE_URL` pointed at recovery target

> WAL/archive settings alone do **not** prove paid PITR. Do not claim RPO ≤ 1 h until dashboard confirms PITR and a restore drill measures lag.

---

## 4. Recovery architecture

```
Incident → Supabase backup/PITR restore (NEW project)
         → Vercel env repoint + deploy/rollback
         → scripts/disaster-recovery/validate-recovery-integrity.mjs
         → scripts/qa-staging-tenant-isolation.mjs (JWT probes)
         → OPS_ALERT_WEBHOOK_URL notification (deduped)
```

Staging drill mode used in Phase 5: **non-destructive validation** on live staging (fixture seed + integrity checks) because in-place destructive restore is prohibited.

---

## 5. Recovery drill procedure

```bash
# Staging-only — linked CLI must be gprmsufvhabntbrytwyi
npm run phase5:dr:audit
npm run phase3:seed:staging-tenant    # if Phase 3 fixtures missing
npm run phase5:dr:seed
npm run phase5:dr:validate
npm run phase5:dr:storage
npm run phase5:dr:drill               # orchestrates all + writes report
```

Synthetic fixture marker: `PHASE5-DR-SYNTHETIC-v1`  
Evidence files:

| File | Purpose |
|------|---------|
| `coverage/phase5-drill-report.json` | RPO/RTO measurements + step timings |
| `coverage/phase5-recovery-validation.json` | Integrity checklist |
| `coverage/phase5-recovery-fixture.json` | Checksum + IDs |
| `coverage/phase5-storage-consistency.json` | Attachment gap analysis |
| `e2e/.phase5-dr-env.local` | Gitignored fixture IDs (local) |

### Drill timestamps (2026-08-28 UTC)

| Milestone | Timestamp |
|-----------|-----------|
| Incident declared | `2026-08-28T20:43:43.965Z` |
| Recovery start | `2026-08-28T20:43:43.967Z` |
| Validation complete | `2026-08-28T20:43:52.435Z` |
| Destructive restore performed | **No** |

---

## 6–9. Measured RPO / RTO / integrity

| Metric | Value | Pass? |
|--------|-------|-------|
| **Actual RPO** | **24 h** (daily backup assumption; PITR unverified) | **FAIL** (target ≤ 1 h) |
| **Actual RTO (validation scope)** | **0.14 min** | PASS for validation-only scope |
| **Full restore RTO** | Not measured | **Not PASS** |
| Clinical data checksum | Match | PASS |
| Tenant isolation | No cross-clinic leak | PASS |
| Audit trail | `recovery_fixture_seeded` present | PASS |
| App `/api/health/ready` | 503 during drill (offline skip); Supabase REST OK | Partial |

---

## 10. Storage recovery status

| Item | Status |
|------|--------|
| Independent storage backup/versioning | Platform-managed; not separately verified |
| DB-only restore risk | **P1** — `patient_attachments.file_path` may reference missing objects |
| Phase 3 synthetic attachment | DB metadata **1 row**; storage object **missing** (`storageObjectPresent: false`) |
| Mitigation | Full-project restore or re-upload; run `npm run phase5:dr:storage` post-restore |

Evidence: `coverage/phase5-storage-consistency.json`

---

## 11. Migration recovery strategy

Migrations are **forward-only**. Rollback = **forward-fix** migration or PITR restore to new project.

| Guardrail | Implementation |
|-----------|----------------|
| Destructive SQL scan | `scripts/disaster-recovery/migration-preflight.mjs` |
| Patterns | `DROP TABLE`, `DROP COLUMN`, `TRUNCATE TABLE`, mass `DELETE`, unsafe `ALTER … DROP` |
| Override | `-- @drflow-destructive-ok` or `DRFLOW_DESTRUCTIVE_MIGRATION_REVIEWED` after DBA review |
| CI enforcement | `--enforce` flag (default informational for historical migrations) |
| Irreversible risks | Column drops, truncate, audit table changes — require staged apply + backup |

Compensating migration procedure: document in PR → apply to staging → verify schema gate → production window with PITR confirmed.

---

## 12. Secrets / environment recovery checklist

Recover from **Vercel project settings** and **Supabase dashboard** — never commit values.

| Variable | Recovery location |
|----------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `ANON_KEY` | Supabase → API keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API keys (rotate if compromised) |
| `DATABASE_URL` | Supabase → Database → Connection string (store in password manager only) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry project settings |
| `DRFLOW_SENTRY_STAGING` | Vercel env (`1` to enable staging capture) |
| `OPS_ALERT_WEBHOOK_URL` | Vercel env / ops webhook provider |
| Mercado Pago / billing secrets | Vercel env + MP dashboard |
| Email provider (`SMTP_*` / provider API keys) | Vercel env |
| Webhook secrets (`MERCADOPAGO_WEBHOOK_SECRET`, etc.) | Vercel env |
| `VERCEL_*` deployment metadata | Automatic on Vercel |

After rotation: redeploy staging → `npm run check:health` → `npm run phase5:dr:validate`.

---

## 13. Operational alert webhooks

| Component | Location |
|-----------|----------|
| Alert dispatch | `src/core/observability/ops-alert.ts` |
| Threshold definitions | `src/core/renapdis/operational-readiness.ts` → `OPS_ALERT_THRESHOLDS` |
| Health failure hook | `src/core/observability/health.ts` → `recordHealthCheckEvent` |
| Clinical/auth error hook | `src/core/errors/log-error.server.ts` |
| CLI test | `npm run phase5:dr:alert-test` |

### Payload contract (no PHI)

- `event_code`, `severity`, `environment`, `correlation_id`, `timestamp`, `message`
- Dedup: **3 alerts / 5 min** per `(event_code, severity)`
- Env: `OPS_ALERT_WEBHOOK_URL`

| Severity | Event codes |
|----------|-------------|
| **P0** | `db_unavailable`, `readiness_failure`, `clinical_save_failure_spike`, `widespread_5xx`, `severe_auth_failure` |
| **P1** | `sustained_latency_breach`, `elevated_429`, `connection_pressure`, `slow_query_regression`, `background_job_failure`, `backup_verification_failed` |

**Staging status:** Wiring complete; webhook delivery requires `OPS_ALERT_WEBHOOK_URL` in Vercel/staging env (skipped safely when unset).

---

## 14. Sentry staging verification

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Server capture |
| `DRFLOW_SENTRY_STAGING=1` | Enable capture outside production |

Script: `npm run phase5:dr:sentry-verify` — sends synthetic `Phase5SyntheticOpsTest` with PHI field redaction test.

**Status:** Script implemented; live event confirmation requires DSN configured on staging deployment (operator verifies in Sentry UI: environment, release SHA, no PHI).

---

## 15. Automated DR checks (`scripts/disaster-recovery/`)

| Script | Purpose |
|--------|---------|
| `audit-backup-capabilities.mjs` | Backup/PITR inventory (read-only) |
| `seed-recovery-fixture.mjs` | Synthetic patient + HC + audit |
| `validate-recovery-integrity.mjs` | Post-restore validation JSON |
| `storage-consistency-check.mjs` | DB ↔ storage metadata |
| `run-staging-drill.mjs` | Orchestrator + RPO/RTO report |
| `migration-preflight.mjs` | Destructive SQL guard |
| `dispatch-operational-alert.mjs` | Webhook smoke test |
| `verify-sentry-staging.mjs` | Synthetic Sentry event |

---

## 16. Remaining P0 / P1

| ID | Item | Severity | Status |
|----|------|----------|--------|
| **BL-P0-2** | RPO ≤ 1 h proven with PITR + restore drill | P0 | **OPEN** |
| **BL-P0-1** | k6 / 1 000-user load test | P0 | OPEN (Phase 7) |
| DR-P1-1 | Full DB restore RTO not measured | P1 | OPEN |
| DR-P1-2 | Storage object missing for synthetic attachment | P1 | OPEN |
| DR-P1-3 | `DATABASE_URL` not in local env for pg_dump drills | P1 | OPEN |
| DR-P1-4 | `OPS_ALERT_WEBHOOK_URL` not confirmed on staging Vercel | P1 | OPEN |

---

## 17. BL-P0-2 final verdict

| Check | Result |
|-------|--------|
| Backup verified | Yes (managed daily; PITR unconfirmed) |
| RPO ≤ 1 h | **NO** (~24 h) |
| RTO ≤ 2 h (full restore) | **Not demonstrated** |
| Integrity + tenant isolation | **Yes** (validation drill) |
| Operational alerts | **Wired** (env-dependent delivery) |

### **BL-P0-2: FAIL — remains OPEN**

---

## 18. Validation executed

| Gate | Result |
|------|--------|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ (after Phase 5 file fixes) |
| `npm run test:phase5` | ✅ 5/5 |
| `npm run test:rls:static` | ✅ 23/23 |
| `npm run security:gate` | ✅ |
| `npm run performance:gate` | ✅ |
| `npm run build` | ✅ |
| `npm run phase5:dr:drill` | ✅ steps pass; **BL-P0-2 NO-GO** |
| RLS live | Not re-run (Phase 3 evidence still valid) |

---

## 19. Phase 6 gate

**GO / NO-GO for Phase 6:** **NO-GO**

Rationale: Actual RPO **exceeds 1 hour** without verified PITR. Enable PITR on staging (or production target tier), restore to an isolated project, measure RPO/RTO, then re-open Phase 5 sign-off.

Do **not** proceed automatically to Phase 6.

---

## 20. Phase 5 Revalidation (2026-08-28)

Second pass to close **BL-P0-2** with explicit Management API verification — **no WAL/archive inference**.

### Step 1 — PITR verification (Management API)

| Field | Value |
|-------|-------|
| **Source** | `supabase backups list --project-ref gprmsufvhabntbrytwyi --output-format json` |
| **PITR enabled** | **`false`** |
| Earliest recovery point | `null` (PITR off) |
| Latest recovery point | `null` (PITR off) |
| Retention window | N/A until addon enabled |
| Latest daily physical backup | `2026-08-28T07:35:53.048Z` |
| Implied RPO without PITR | **~13.4 h** (and up to ~24 h between snapshots) |

Evidence: `coverage/phase5-pitr-evidence.json`

### ⛔ MANUAL INFRA ACTION REQUIRED

Infrastructure execution **STOPPED** at Step 1. Isolated PITR restore **not attempted**.

```
Supabase Dashboard
→ DrFlow-Staging (gprmsufvhabntbrytwyi)
→ Database
→ Backups
→ Point-in-Time Recovery
→ Enable PITR add-on (pitr_7 minimum on Pro/Team)
```

After enablement: `npm run phase5:dr:verify-pitr` → measure RPO → restore to **new project** → measure full RTO.

### Steps 2–3 — Effective RPO / isolated restore

| Step | Status |
|------|--------|
| Synthetic transaction T0 + PITR lag measurement | **BLOCKED** — PITR disabled |
| Restore to new project | **NOT PERFORMED** |
| Full RTO measured | **NOT MEASURED** |

### Step 4 — Restore data validation

| Check | Status |
|-------|--------|
| Against **restored** project | **N/A** — no restore performed |
| Against **live staging** (baseline) | PASS — prior drill evidence still valid |

### Step 5 — Platform config checklist

Created: [PHASE-5-PLATFORM-RECOVERY-CHECKLIST.md](./PHASE-5-PLATFORM-RECOVERY-CHECKLIST.md)

### Step 6 — Storage recovery (DR-P1-2)

| Item | Status |
|------|--------|
| `seed-storage-fixture.mjs` | Uploads minimal PDF to `clinical-files` bucket |
| `storage-integrity.mjs` | DB ↔ object ↔ clinic path ↔ checksum |
| Live staging after seed | **PASS** — object readable, clinic path correct |
| Post-DB-restore storage | **Separate concern** — objects not in Postgres backup |

Evidence: `coverage/phase5-storage-fixture.json`, `coverage/phase5-storage-integrity.json`

### Step 7 — Logical backup fallback

| Item | Status |
|------|--------|
| Script | `scripts/disaster-recovery/logical-backup.mjs` |
| `DATABASE_URL` locally | **REQUIRED — not configured** |
| Automated backup artifacts | **Not produced** (setup gate) |

Evidence: `coverage/phase5-logical-backup-status.json`

### Step 8 — Operational alerts (DR-P1-4)

| Item | Status |
|------|--------|
| Code wiring | Complete (`ops-alert.ts`) |
| `OPS_ALERT_WEBHOOK_URL` staging | **Not configured** (local + Vercel preview check) |
| Live delivery verified | **NO** — cannot mark PASS |

### Step 9 — Sentry live verification

| Item | Status |
|------|--------|
| `SENTRY_DSN` / `DRFLOW_SENTRY_STAGING=1` | **Not configured** locally |
| Live event in Sentry UI | **NOT VERIFIED** |

### BL-P0-2 revalidation verdict

| # | Criterion | Met? |
|---|-----------|------|
| 1 | PITR actually enabled | **NO** |
| 2 | Latest recovery point verified | **NO** |
| 3 | Actual RPO ≤ 1 h | **NO** (~13–24 h daily bound) |
| 4 | Real database restore performed | **NO** |
| 5 | Full RTO measured | **NO** |
| 6 | Full RTO ≤ 2 h | **NO** |
| 7–10 | Post-restore clinical/audit/RLS/tenant | **N/A** (no restore) |

### **BL-P0-2: OPEN — Phase 6 remains NO-GO**
