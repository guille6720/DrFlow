# Phase 1 — Production Readiness Baseline Audit

**Repository:** [guille6720/DrFlow](https://github.com/guille6720/DrFlow)  
**Workspace audited:** `DrFlow-staging` (branch `release/0.2.19-staging-promotion`)  
**Application version:** `0.2.19`  
**Audit date:** 2026-08-28  
**Auditor role:** Senior Staff / QA / Security / Performance / Production Readiness  
**Scope:** Read-only baseline — **no implementation changes in Phase 1**

---

## Executive summary

DrFlow is a **mature, multi-tenant clinical SaaS** built on **Next.js 16 + React 19 + Supabase PostgreSQL + Vercel**. The codebase shows **strong intentional investment** in compliance, tenant isolation, static security gates, and clinical integrity (especially migrations **154/155** and recent patient-workspace isolation hardening).

**Strengths today**

- 168 forward SQL migrations with RLS manifest CI (`91` tables)
- Layered isolation: DB RLS + SECURITY DEFINER RPC checks + app ownership guards
- Immutable audit trails (`audit_logs`, `clinical_record_audit`)
- Private clinical storage with signed URLs only
- Extensive Vitest suite (~329 test files, ~1,850+ cases) and 14-step CI quality gate
- Recent staging release gate automation (`scripts/qa-staging-release-gate.mjs`, Playwright isolation spec)

**Critical gaps before claiming 1,000-user readiness**

| ID | Finding | Priority |
|----|---------|----------|
| BL-P0-1 | **No authenticated k6/load test evidence** — scalability claims must not exceed measured concurrency | **P0** |
| BL-P0-2 | **RPO ≤ 1 h not proven** — daily backups alone ≈ 24 h RPO; PITR status unverified in repo | **P0** |
| BL-P0-3 | **Live cross-tenant JWT integration tests incomplete** — static RLS audit strong; runtime User A → Clinic B probe missing | **P0** |
| BL-P1-1 | Warm navigation still **1.7–2.6 s** (dev); no production p95/p99 under load | **P1** |
| BL-P1-2 | **No k6 / Grafana load suite** in repository | **P1** |
| BL-P1-3 | Staging clinical E2E not wired to CI (placeholder Supabase in pipeline) | **P1** |
| BL-P1-4 | In-memory rate limits (no cross-instance coordination on Vercel) | **P1** |
| BL-P1-5 | Remaining `SELECT *` and N+1 patterns on import/clinical hot paths | **P1** |
| BL-P1-6 | `pg_stat_statements` not enabled/documented for staging diagnostics | **P1** |

**Phase 1 verdict:** Foundation is **production-capable for controlled rollout**, but **not yet evidence-backed for 1,000 concurrent users**. Proceed to Phase 2–10 per plan; do **not** skip load testing (Phase 7) before making capacity claims.

**Priority legend**

- **P0** — Production blocker / must not promote without resolution or explicit acceptance
- **P1** — Must fix before targeting 1,000 users
- **P2** — Improvement; mitigated but should be tracked
- **P3** — Future optimization / hygiene

---

## 1. Architecture

### Current state

| Layer | Location | Notes |
|-------|----------|-------|
| App Router | `src/app/` | Route groups: `(dashboard)`, `(auth)`, `(marketing)`, `portal/[slug]` |
| Feature modules | `src/features/` (~25 domains) | `pacientes`, `historias`, `agenda`, `recetas`, `ia`, `integraciones`, etc. |
| Core platform | `src/core/` | Auth, Supabase, security, entitlements, observability, compliance |
| Shared lib | `src/lib/` | Cross-cutting actions, auth bootstrap, utils |
| Database | `supabase/migrations/` | **168** forward migrations |

**Mutation patterns**

- **~80** `"use server"` modules — primary authenticated mutation path
- **31** API routes — webhooks, cron, health, public REST v1, auth, clinical persist

**Middleware** (`src/middleware.ts` → `src/core/supabase/middleware.ts`)

- Supabase SSR session refresh
- Auth redirect for dashboard routes
- `drflow_clinic_id` cookie bootstrap
- `x-drflow-trace-id` response header
- Bypasses: health, jobs, observability purge, v1 API, billing webhooks, static assets

### Findings

| ID | Finding | Priority | Evidence |
|----|---------|----------|----------|
| ARCH-1 | Feature-sliced architecture with clear core/features split | ✅ Strength | `src/features/`, `src/core/` |
| ARCH-2 | Dual security header config (`next.config.ts` + `vercel.json`) — drift risk | **P2** | Both define CSP/HSTS |
| ARCH-3 | Legacy monolith components allowlisted above 350-line gate | **P2** | `scripts/architecture-gate.mjs` |
| ARCH-4 | Server actions + API routes split is coherent and documented in code | **P3** | `src/app/api/`, `src/lib/actions/` |

---

## 2. Supabase / PostgreSQL database

### Current state

- **168** forward migrations; **13** rollback helpers in `supabase/migrations/rollback/`
- **~87** tables created across migrations
- **~212** explicit `CREATE INDEX` statements
- **34+** migration files enable RLS
- **~237** `SECURITY DEFINER` function occurrences (large privileged surface, progressively hardened in `20260826*` batch)

**Key clinical tables:** `patients`, `clinical_records`, `clinical_record_diagnoses`, `clinical_record_treatments`, `clinical_record_audit`, `prescription_drafts`, `medical_orders`, `patient_attachments`, `appointments`

**Staging ref:** `gprmsufvhabntbrytwyi` · **Production ref:** `nipqdarduknydqptqzup` (`scripts/supabase-project-refs.mjs`)

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| DB-1 | Rich migration history with integrity/audit phases (130, 132, 154, 155) | ✅ **P3** strength |
| DB-2 | Forward-only prod strategy; down migrations staging-only | **P2** (by design — needs runbooks) |
| DB-3 | `supabase/config.toml` points at **production** ref (auth URL tooling) — footgun in staging workspace | **P1** |
| DB-4 | Schema validation scripts + `scripts/validate-schema.mjs` | ✅ **P3** |
| DB-5 | No runtime query telemetry in repo | **P1** (see §20) |

---

## 3. Multi-tenant clinic isolation

### Current state

**Tenant key:** `clinic_id` on virtually all PHI/operations tables.

**DB helpers:** `user_clinic_ids()`, `user_role_in_clinic()`, `can_view_clinical`, `can_write_clinical`, `assert_public_api_clinic_access` (migration 133)

**App layer:** `src/core/security/tenant-scope.ts`, `src/core/security/ownership-guard.ts`, active clinic cookie `drflow_clinic_id`

**Recent client hardening:** patient-scoped cache keys, `key={patientId}` remounts, Gemini sessionStorage scoped by `{clinicId}:{patientId}`

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| TEN-1 | Defense-in-depth model (RLS + RPC + app guards) | ✅ **P3** strength |
| TEN-2 | Service role bypasses RLS — all admin paths must filter by `clinic_id` | **P1** |
| TEN-3 | Warm-path clinic cookie may skip full membership re-validation | **P2** |
| TEN-4 | Cross-patient UI leakage fixed in staging; browser E2E validates A/B isolation | ✅ **P3** (recent) |
| TEN-5 | Public API cross-tenant RPC issue addressed in migration 133 | ✅ Resolved (was **P0**) |

---

## 4. RLS (Row Level Security)

### Current state

- Manifest: `src/core/security/rls-manifest.ts` — **91 tables** requiring RLS
- Static CI: `tests/rls-policies.test.ts`, `tests/rls-audit-hardening.test.ts`, `tests/rls-performance-hardening.test.ts`
- Recent: staff policies restricted to `authenticated` role (`20260826151000_*`)
- Integration: `tests/cross-tenant-rls.integration.test.ts` — **opt-in** (`DRFLOW_RLS_INTEGRATION=1`)

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| RLS-1 | Static manifest enforcement in CI | ✅ **P3** strength |
| RLS-2 | No default live JWT cross-tenant read/write proof | **P0** |
| RLS-3 | Storage RLS policies in migration 136 — static tests only | **P1** |
| RLS-4 | SECURITY DEFINER RPC manifest tracked in `rls-manifest.ts` | ✅ **P3** |

---

## 5. Authentication

### Current state

- Login: `POST /api/auth/login` — CSRF same-origin, IP rate limit (30/15 min), Zod validation, Supabase password auth
- Post-login: `runPostLoginBootstrap`, device session claim (max **3** devices)
- Middleware: 5 s auth timeout; missing cookie → `/login`
- Patient portal: separate HttpOnly cookie `drflow_patient_portal` (not Supabase staff session)

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| AUTH-1 | Login CSRF + rate limit + device cap | ✅ **P3** strength |
| AUTH-2 | Auth timeout returns null user — edge-case transient behavior | **P2** |
| AUTH-3 | E2E staging account provisioning script exists (`configure-staging-e2e-account.mjs`) | ✅ **P3** |
| AUTH-4 | Playwright must use `localhost` not `127.0.0.1` for cookie domain alignment | **P2** (ops) |

---

## 6. Authorization / RBAC

### Current state

- App roles: `superadmin`, `clinic_admin`, `doctor`, `secretary`, `patient` — `src/core/permissions/roles.ts`
- `hasPermission()` with per-member overrides (`clinic_member_permissions`, migration 071)
- DB clinical gates independent of app UI overrides (`can_view_clinical` / `can_write_clinical`)

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| RBAC-1 | App permission overrides not reflected in DB RLS (doctor denied in UI may still query via PostgREST) | **P1** |
| RBAC-2 | Secretary blocked from HC at DB; demographic fields in `patients` still readable — document for compliance | **P2** |
| RBAC-3 | Route gating via `canAccessRoute` in dashboard shell | ✅ **P3** |

---

## 7. Clinical record integrity

### Current state

**Migration 154:** `update_clinical_record_atomic` raises `PATIENT_MISMATCH` when `p_patient_id ≠ record.patient_id`

**Migration 155:** `clinical_record_audit.patient_id` backfilled, NOT NULL, trigger-derived on INSERT

**App:** `verifyClinicalRecordPatientMatch` in `ownership-guard.ts`; used in clinical records actions and `/api/clinical-records/persist`

**Staging validation:** `scripts/qa-staging-patient-mismatch-auth.mjs` — **PASS** (authenticated probe)

**Integrity gate:** `clinical_record_audit_patient_mismatch = 0`, total violations = 0

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| CLI-1 | DB-enforced patient identity lock on atomic HC update | ✅ **P3** strength |
| CLI-2 | Audit ownership derivation on INSERT | ✅ **P3** strength |
| CLI-3 | Direct audit INSERT from import helpers bypasses RPC authorship path (trigger mitigates) | **P2** |
| CLI-4 | Confirm 154/155 applied on production before promotion | **P1** (release process) |

---

## 8. Audit trail

### Current state

- `audit_logs` — system-wide, immutable (triggers prevent UPDATE/DELETE)
- `clinical_record_audit` — HC-specific with `old_values`/`new_values`, version bump
- RLS INSERT requires `changed_by = auth.uid()` and clinic membership
- Tests: `tests/audit-log-security-fase9.test.ts`, `tests/clinical-record-audit-ownership.test.ts`

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| AUD-1 | Immutable audit architecture | ✅ **P3** strength |
| AUD-2 | SECURITY DEFINER RPCs must always write audit rows — rely on RPC discipline | **P2** |
| AUD-3 | 541-row staging backfill completed safely (migration 155) | ✅ **P3** |

---

## 9. File storage security

### Current state

- Bucket: `clinical-files` (private) — migration `136_storage_security.sql`
- App: signed URLs only — `src/core/compliance/storage-security.ts`
- Path classification + RLS helpers: `can_read_clinical_storage()`, `can_write_clinical_storage()`
- Tests: `tests/storage-security-fase14.test.ts`

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| STO-1 | No public URLs; TTL-bound signed downloads | ✅ **P3** strength |
| STO-2 | No runtime cross-clinic storage access integration test | **P1** |
| STO-3 | JSON export MIME expansion (153) — review abuse surface | **P2** |

---

## 10. Input validation

### Current state

- **23** Zod schema files under `src/core/validations/`
- `parseActionInput()` pattern for server actions
- API routes use Zod + structured 400 responses
- Audit sample: `tests/input-validation-audit.test.ts`

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| VAL-1 | Broad Zod adoption on auth, booking, clinical, billing | ✅ **P3** strength |
| VAL-2 | No exhaustive enumeration of all server actions for schema coverage | **P2** |
| VAL-3 | `clinical-records/persist` uses typed body + partial schema | **P2** |

---

## 11. API security

### Current state

- **31** API routes
- CSRF: `src/core/security/csrf.ts` — static audit `tests/csrf-audit.test.ts`
- Rate limits: login 30/15 min/IP; public API 120/min/key; in-memory store
- Cron: `CRON_SECRET`; webhooks: MercadoPago HMAC
- Public v1: API key + entitlement wrapper

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| API-1 | CSRF audit passes for mutation routes | ✅ **P3** strength |
| API-2 | In-memory rate limits don't coordinate across Vercel instances | **P1** |
| API-3 | Many API paths skip middleware session refresh — routes self-auth | **P2** |
| API-4 | Not all authenticated APIs rate-limited | **P2** |

---

## 12. Session handling

### Current state

- Supabase SSR cookies + `drflow_clinic_id` (httpOnly, 1 yr)
- Device sessions: `user_device_sessions` — max 3 concurrent (`109_user_device_sessions.sql`)
- Portal sessions: token hash in DB, HttpOnly cookie, slug validation

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| SES-1 | Multi-cookie model with device limits | ✅ **P3** strength |
| SES-2 | Portal fail-closed on invalid/expired/cross-clinic tokens (E2E covered) | ✅ **P3** |
| SES-3 | No E2E for staff multi-clinic switching | **P3** |

---

## 13. Error handling

### Current state

- Server: `src/core/errors/log-error.server.ts` → console + observability event + Sentry
- Client: `log-error.client.ts`
- PHI sanitization: `src/core/observability/sanitize-monitoring-payload.ts`
- User-facing auth errors mapped in login route (no raw Supabase messages)

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| ERR-1 | Centralized logging with sanitization hooks | ✅ **P3** strength |
| ERR-2 | Not all server actions verified to use sanitized logging | **P2** |
| ERR-3 | Clinical save failures need alert wiring (Phase 5) | **P1** (observability) |

---

## 14. Observability

### Current state

- Sentry: `src/instrumentation.ts`, `sentry.server.ts`, `sentry.client.ts` — optional via `SENTRY_DSN`, prod-only sampling
- Trace IDs: middleware + `withObservabilityApiRoute`
- DB table: `clinic_observability_events` (migration 052)
- UI panel: clinic observability in configuración
- Existing docs: `OBSERVABILITY_REPORT.md`, `docs/PERFORMANCE_MONITORING.md`

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| OBS-1 | Sentry optional — disabled without DSN | **P2** |
| OBS-2 | Trace IDs not guaranteed on all server actions | **P2** |
| OBS-3 | No automated test that Sentry receives events in staging | **P2** |
| OBS-4 | PHI must never reach Sentry — sanitization module exists; needs Phase 5 audit | **P1** |
| OBS-5 | `OPS_ALERT_WEBHOOK_URL` external verification required | **P1** |

---

## 15. Backups and recovery

### Current state

- Manual: `scripts/backup-supabase.mjs` → `pg_dump` to `backups/`
- Docs: `docs/DISASTER_RECOVERY.md`, `docs/compliance/RENAPDIS_DR_DRILL.md`
- Supabase platform daily backups (external)

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| BAK-1 | **RPO ≤ 1 h not met** without PITR — daily backup ≈ 24 h RPO | **P0** |
| BAK-2 | Restore drill to isolated project not evidenced in repo | **P1** |
| BAK-3 | No automated backup schedule in repository | **P1** |
| BAK-4 | RTO target < 2 h documented; app rollback minutes; DB restore unproven | **P1** |

---

## 16. CI/CD

### Current state

**GitHub Actions** (`.github/workflows/ci.yml`): typecheck, lint, code-quality, security, architecture, stabilization, unit tests, coverage (≥90% core), critical coverage (≥95%), performance gate, RLS static, build, health smoke

**E2E job:** Playwright smoke only (placeholder Supabase)

**Husky:** pre-commit `lint-staged` only — no pre-push gate

**Deploy:** Vercel auto-deploy from `main`; `npm run deploy:vercel`

**Not in CI:** `commercial:gate`, staging release E2E, `validate:env:production`, k6 load tests

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| CI-1 | Strong multi-gate CI on main/PR | ✅ **P3** strength |
| CI-2 | Staging clinical E2E + `commercial:gate` absent from CI | **P1** |
| CI-3 | No pre-deploy production env validation in pipeline | **P1** |
| CI-4 | Lighthouse/bundle audit scripts exist but not in CI | **P2** |
| CI-5 | Husky pre-commit only | **P2** |

---

## 17. Unit tests

### Current state

- **329** `.test.ts` files + **7** `.tsx` in `tests/`
- **~1,850+** test cases
- Coverage scoped: `tests/coverage-scope.ts` — core lib ≥90%; **`*.server.ts` excluded**
- Performance unit suite: **22** files in `tests/performance/`

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| UT-1 | Extensive compliance/security/clinical unit coverage | ✅ **P3** strength |
| UT-2 | Server loaders/actions largely outside coverage gate | **P2** |
| UT-3 | Patient isolation tested at logic layer; not full stack by default | **P1** |

---

## 18. Integration tests

### Current state

- RLS static: always runs
- Cross-tenant: `tests/cross-tenant-rls.integration.test.ts` — service-role proxy checks; **no User A JWT → Clinic B PHI attempt**
- Staging DB assertions: `scripts/phase6-db-assertions-staging.mjs`

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| INT-1 | Live JWT cross-tenant isolation test missing | **P0** |
| INT-2 | Integration suite skipped unless `DRFLOW_RLS_INTEGRATION=1` | **P1** |
| INT-3 | Storage cross-tenant runtime test missing | **P1** |

---

## 19. E2E tests

### Current state

**9** Playwright specs in `e2e/`:

| Spec | Coverage |
|------|----------|
| `smoke.spec.ts` | Login page, auth redirect, health API |
| `auth.spec.ts` | Login → dashboard |
| `attend-now.spec.ts` | Start consultation |
| `prescription-wizard.spec.ts` | Rx draft/issue |
| `release-gate-staging.spec.ts` | A/B isolation, agenda, waiting room, perf nav |
| `patient-portal-secure-access.spec.ts` | Portal tokens, cross-clinic denial |
| `public-booking.spec.ts` | Anonymous booking |
| `a11y-*.spec.ts` | Theme a11y (not in default CI) |

**Staging gate results (2026-08-28):** isolation PASS, agenda PASS, waiting room PASS; warm nav ~1.7–2.6 s (dev)

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| E2E-1 | Core smoke in CI; staging clinical gate manual | **P1** |
| E2E-2 | Missing E2E: permission denial, tenant access, session expiry, full SOAP→save→reload | **P1** (Phase 4) |
| E2E-3 | Phase 6 seed required — `scripts/phase6-seed-staging-e2e.mjs` | **P2** (ops) |
| E2E-4 | A11y E2E projects not in CI | **P3** |

---

## 20. Database performance

### Current state

- Index strategy documented in `DATABASE_REPORT.md`, `INDEX_AUDIT_REPORT.md`
- Performance migrations: `054_database_audit_fixes.sql`, `090_rls_performance_hardening.sql`, `089_n_plus_one_rpcs.sql`
- **`pg_stat_statements`:** referenced in docs as recommendation only — **not enabled in repo**

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| PERF-DB-1 | No runtime slow-query telemetry | **P1** |
| PERF-DB-2 | Static index audit strong; runtime validation missing | **P2** |
| PERF-DB-3 | RLS helper indexes exist (`idx_clinic_members_user_active_clinic`, etc.) | ✅ **P3** |

---

## 21. Pagination

### Current state

Central module: `src/core/supabase/pagination.ts`

| Constant | Value |
|----------|-------|
| `PACIENTES_PAGE_SIZE` | 25 |
| `PATIENT_EHR_RECORD_PAGE_SIZE` | 80 |
| `APPOINTMENTS_AGENDA_MAX` | 1200 |
| `PATHOLOGY_SEARCH_RECORD_SCAN_LIMIT` | 2000 |

Tests: `tests/pagination.test.ts`, `tests/performance/global-pagination.test.ts`

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| PAG-1 | Most list endpoints paginated or capped | ✅ **P3** strength |
| PAG-2 | Large scan caps (1200/2000) — latency risk at scale | **P2** |
| PAG-3 | Offset pagination dominant; keyset available but not universal | **P3** |

---

## 22. N+1 queries

### Current state

- RPC batch mitigations: migration `089_n_plus_one_rpcs.sql`
- Tests: `tests/performance/n-plus-one-migration.test.ts`, `batch-patient-record-counts.test.ts`
- Known risk: `src/features/integraciones/server/build-bulk-clinical-export.ts` — per-patient loops

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| N1-1 | Bulk clinical export N+1 at scale | **P1** |
| N1-2 | Batch RPC patterns exist for record counts | ✅ **P3** |
| N1-3 | Signature URL batching via `createSignedUrls` | ✅ **P3** |

---

## 23. SELECT *

### Current state

Guard: `tests/performance/no-select-star.test.ts` — enforces column discipline on key repositories

**Remaining violations in `src/`:**

| File | Priority |
|------|----------|
| `clinical-records.service.ts` | **P1** |
| `patient-import-session.ts` (6×) | **P1** |
| `fhir-import-session.ts` (2×) | **P1** |
| `clinic-services.ts`, `cash-register.ts`, `admin-documents.ts`, `subscription-service.ts` | **P2** |

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| SEL-1 | Wildcard selects on clinical insert return paths | **P1** |
| SEL-2 | Import pipelines use `select("*")` extensively | **P1** |
| SEL-3 | `select-columns.ts` discipline module exists | ✅ **P3** |

---

## 24. Slow queries

### Current state

- No production/staging `pg_stat_statements` snapshot in repository
- EXPLAIN targets documented in `DATABASE_REPORT.md`
- Staging release gate runs integrity SQL probes

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| SLOW-1 | No automated slow-query capture | **P1** |
| SLOW-2 | Recommend enabling `pg_stat_statements` on staging (Phase 2) | **P1** |

---

## 25. Caching

### Current state

- Request-scoped: React `cache()` in `src/lib/server/cached-clinic-queries.ts`
- Cross-request: `unstable_cache` in `src/lib/server/clinic-metadata-unstable-cache.ts` (TTL 120–600 s)
- Recent perf fix: parallel `getCachedClinicFeatures` + `getCachedClinicEntitlements` in dashboard shell
- Post-login bootstrap skips membership fetch when clinic cookie present

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| CACHE-1 | Intelligent clinic metadata caching with tags | ✅ **P3** strength |
| CACHE-2 | Cache keyed by `clinicId` — auth must precede cache call | **P2** risk if misused |
| CACHE-3 | Warm nav improved but still >1.5 s — further profiling needed | **P1** |

---

## 26. Realtime usage

### Current state

**Two** Supabase realtime channels:

1. `clinical-ops-{clinicId}` — appointments, prescription_drafts, medical_orders
2. `waiting-room-{clinicId}` — appointments

Both debounce `router.refresh()` on `postgres_changes` filtered by `clinic_id`.

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| RT-1 | Minimal realtime surface — low blast radius | ✅ **P3** |
| RT-2 | No automated subscription/cleanup tests | **P3** |
| RT-3 | Realtime + RLS not integration-tested | **P2** |

---

## 27. Large component / hook technical debt

### Current state

Architecture gate (`scripts/architecture-gate.mjs`):

- Components max **350** lines (allowlist for legacy monoliths)
- Hooks max **280** lines hard / **150** stabilization target
- Stabilization gate tracks additional debt

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| DEBT-1 | Allowlisted legacy components exceed target | **P2** |
| DEBT-2 | Patient workspace shell/hook complexity reduced but still hot paths | **P2** |
| DEBT-3 | Gates prevent uncontrolled growth | ✅ **P3** |

---

## 28. Environment separation

### Current state

| Environment | Supabase ref |
|-------------|--------------|
| Staging | `gprmsufvhabntbrytwyi` |
| Production | `nipqdarduknydqptqzup` |

Guards: `ALLOW_STAGING_DB_PUSH`, `ALLOW_PRODUCTION_DB`, `assertLinkedStagingOrExit()`, production URL refusal in staging scripts

Scripts: `sync-staging-env-from-cli.mjs`, `configure-staging-e2e-account.mjs`, `qa-staging-release-gate.mjs`

`.env.local` gitignored (`.env*`); template: `.env.example`

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| ENV-1 | Script-level prod/staging separation is strong | ✅ **P3** strength |
| ENV-2 | `config.toml` production ref in staging clone | **P1** |
| ENV-3 | No committed `.env.staging.example` | **P2** |
| ENV-4 | CI uses placeholder Supabase — no real env matrix | **P1** |

---

## 29. Production rollback

### Current state

- App: Vercel promote/rollback, git revert + push, manual `deploy:vercel.mjs`
- DB: forward-only migrations in prod; down scripts staging-only
- Docs: `docs/DISASTER_RECOVERY.md`, PR template rollback checkbox

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| ROLL-1 | App rollback documented; **fully manual** | **P1** |
| ROLL-2 | No scripted Vercel rollback to prior deployment ID | **P1** |
| ROLL-3 | App rollback ≠ DB rollback — documented | ✅ **P3** |
| ROLL-4 | PITR unverified blocks RPO claims | **P0** |

---

## 30. Existing performance / load tests

### Current state

| Type | Present | Location |
|------|---------|----------|
| Vitest micro-perf | ✅ 22 files | `tests/performance/` |
| Playwright warm nav | ✅ (staging, manual) | `e2e/release-gate-staging.spec.ts` |
| Lighthouse / bundle audit | ✅ manual scripts | `scripts/lighthouse-audit.mjs`, `performance-audit.mjs` |
| **k6 / Grafana** | ❌ | — |
| **Artillery / Locust** | ❌ | — |
| Concurrent user load test | ❌ | Backlog in `PRODUCTION_READINESS_REPORT.md` (~50 users cited, not tested) |

**Measured staging warm navigation (2026-08-28, dev server):**

| Route | Median (ms) | Worst (ms) | Baseline (~ms) |
|-------|------------:|-----------:|---------------:|
| Dashboard | 2125 | 2314 | ~3080 |
| Agenda | 1771 | 1792 | ~3080 |
| Patients | 1844 | 1922 | ~3090 |
| Clinical History | 2643 | 2649 | ~3070–3100 |
| Consultations | 1795 | 1883 | ~3090 |
| Waiting Room | 1700 | 1728 | ~3070 |

Fixed ~3 s delay **eliminated**; medians still **>1.5 s** (target <1 s not met).

### Findings

| ID | Finding | Priority |
|----|---------|----------|
| LOAD-1 | **No k6 suite — cannot claim 1,000 users** | **P0** |
| LOAD-2 | No spike/soak/breakpoint tests | **P1** |
| LOAD-3 | Vitest perf tests are static/micro — not end-to-end under concurrency | **P2** |
| LOAD-4 | ~3 s navigation plateau removed — meaningful improvement | ✅ **P3** |

---

## Consolidated priority register

### P0 — Production blockers

| ID | Area | Finding |
|----|------|---------|
| BL-P0-1 | Load | No authenticated realistic k6 load test — **do not claim 1,000 users** |
| BL-P0-2 | DR | RPO ≤ 1 h not proven; PITR unverified |
| BL-P0-3 | RLS | Live JWT cross-tenant PHI access test missing |

### P1 — Must fix before 1,000 users

| ID | Area | Finding |
|----|------|---------|
| BL-P1-1 | Perf | Warm nav 1.7–2.6 s; no production p95 under load |
| BL-P1-2 | Load | Create k6 suite (Phase 7) |
| BL-P1-3 | CI | Wire staging E2E + commercial gate |
| BL-P1-4 | API | Distributed rate limiting |
| BL-P1-5 | DB | `SELECT *` + N+1 on clinical/import paths |
| BL-P1-6 | DB | Enable `pg_stat_statements` on staging |
| BL-P1-7 | DR | Restore drill + backup automation |
| BL-P1-8 | RBAC | App permission overrides vs DB RLS gap |
| BL-P1-9 | ENV | `config.toml` prod ref footgun |
| BL-P1-10 | OBS | PHI-safe Sentry + alert wiring |
| BL-P1-11 | STO | Runtime storage cross-tenant test |

### P2 — Improvements

Security header duplication, legacy component debt, trace ID gaps, large pagination caps, manual rollback, Sentry optional, offset pagination, realtime untested, server.ts coverage exclusion, import audit INSERT path.

### P3 — Future optimization

Keyset pagination universalization, a11y E2E in CI, pg_stat monitoring hygiene, multi-clinic switch E2E, doc drift fixes.

---

## Reuse inventory (do not duplicate in later phases)

| Capability | Existing asset |
|------------|----------------|
| Quality gates | `scripts/quality-gate.mjs`, CI workflow |
| RLS manifest | `src/core/security/rls-manifest.ts` + `tests/rls-policies.test.ts` |
| Staging QA | `scripts/qa-staging-release-gate.mjs`, `qa-staging-patient-mismatch-auth.mjs` |
| E2E isolation | `e2e/release-gate-staging.spec.ts` |
| Pagination constants | `src/core/supabase/pagination.ts` |
| Column discipline | `src/core/supabase/select-columns.ts`, `no-select-star.test.ts` |
| Ownership guards | `src/core/security/ownership-guard.ts` |
| Observability | `src/core/observability/*`, migration 052 |
| DR docs | `docs/DISASTER_RECOVERY.md` |
| Performance unit tests | `tests/performance/*` |
| Phase 6 seed | `scripts/phase6-seed-staging-e2e.mjs` |

---

## Phase 1 exit criteria

| Criterion | Status |
|-----------|--------|
| All 30 audit areas documented | ✅ |
| Findings classified P0–P3 | ✅ |
| No implementation changes | ✅ |
| Reuse inventory captured | ✅ |
| Ready for Phase 2 | ✅ **with P0 items tracked** |

---

## Recommended Phase 2 entry conditions

1. Enable `pg_stat_statements` on staging Supabase (dashboard + documented query)
2. Baseline slow queries before index/query changes
3. Fix P1 `SELECT *` / N+1 on clinical and import paths with tests
4. Extend `no-select-star.test.ts` coverage

**Do not proceed to production promotion until Phase 7 load tests provide measured evidence for target concurrency.**

---

## Key reference paths

```
docs/DISASTER_RECOVERY.md
docs/SUPABASE_ENV_SAFETY.md
DATABASE_REPORT.md
INDEX_AUDIT_REPORT.md
OBSERVABILITY_REPORT.md
PRODUCTION_READINESS_REPORT.md
.github/workflows/ci.yml
scripts/quality-gate.mjs
scripts/qa-staging-release-gate.mjs
src/core/security/rls-manifest.ts
src/core/security/ownership-guard.ts
src/core/supabase/pagination.ts
supabase/migrations/154_clinical_record_patient_identity_lock.sql
supabase/migrations/155_clinical_record_audit_patient_ownership.sql
tests/cross-tenant-rls.integration.test.ts
tests/performance/
e2e/release-gate-staging.spec.ts
```

---

*Phase 1 complete. No code or database changes were made during this audit.*
