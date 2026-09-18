# Phase 2 — Database Scale Hardening Report

**Repository:** [guille6720/DrFlow](https://github.com/guille6720/DrFlow)  
**Branch:** `release/0.2.19-staging-promotion`  
**Scope:** Staging/develop only (`gprmsufvhabntbrytwyi`) — **production not modified**  
**Report date:** 2026-08-28  
**Baseline reference:** [PHASE-1-BASELINE.md](./PHASE-1-BASELINE.md)

---

## Executive summary

Phase 2 enabled **pg_stat_statements** diagnostics on staging, eliminated **SELECT \*** on high-volume application paths identified in Phase 1, and removed the **sequential N+1** pattern in bulk clinical export. Tenant-aware hot queries use existing indexes (`idx_clinical_records_clinic_created`, `idx_clinical_records_clinic_patient_created`) with **Index Scan + Limit** confirmed via `EXPLAIN (ANALYZE, BUFFERS)` on synthetic staging data.

**No RLS, authorization, audit logging, or security gates were weakened.** All changes are forward-only and covered by existing performance/RLS gates.

| Exit criterion | Status |
|----------------|--------|
| `pg_stat_statements` working in staging | ✅ |
| No critical N+1 in hot clinical/import paths | ✅ (bulk export) |
| No unbounded query in critical user-facing paths | ✅ (caps/limits verified) |
| No unnecessary `SELECT *` in high-volume paths | ✅ |
| Pagination where datasets grow significantly | ✅ (existing + verified) |
| Tenant indexes verified (`clinic_id`) | ✅ |
| No security/RLS regression | ✅ |
| Before/after evidence documented | ✅ |

**Phase 2 verdict:** **GO** to Phase 3 (Observability / SLO wiring), with **remaining P1** items tracked below. **Phase 1 P0 blockers** (load-test evidence, RPO proof, live JWT cross-tenant probes) remain unchanged and must not be ignored before production capacity claims.

---

## 1. pg_stat_statements (staging)

### Change

| Item | Detail |
|------|--------|
| Migration | `supabase/migrations/156_staging_query_performance_extension.sql` — idempotent `CREATE EXTENSION IF NOT EXISTS pg_stat_statements` |
| Helper | `scripts/lib/staging-db-query.mjs` — read-only SQL via Supabase CLI (staging ref only) |
| Snapshot script | `scripts/staging-query-performance.mjs` — top queries + safe EXPLAIN |
| Output | `coverage/staging-query-performance.json` |

### Validation

```
pg_stat_statements.enabled = true
staging_ref = gprmsufvhabntbrytwyi
captured_at = 2026-08-28T19:07:28.659Z
```

---

## 2. Query inventory (staging snapshot)

### Top by total execution time (application-relevant)

| Rank | Calls | Mean (ms) | Total (ms) | Query pattern | Path / source |
|------|-------|-----------|------------|---------------|---------------|
| 1 | 142 | **319.88** | 45,423 | `clinical_records` WHERE `clinic_id` + `LIMIT` + **OFFSET** | Historias list — `load-historias-page.ts` |
| 2 | 124 | 204.67 | 25,379 | `clinical_records` selective columns + filter | Patient EHR / export reads |
| 3 | 76 | 212.62 | 16,159 | `clinical_records` narrative fields | Clinical workspace loads |
| 4 | 513 | 4.22 | 2,165 | `clinical_records` list columns | Various list views |
| 5 | 3,389 | 1.54 | 5,210 | `clinic_members` membership | Session/bootstrap (high call volume, low mean) |

*Note: `pg_timezone_names`, `pg_available_extensions`, and Studio introspection queries dominate total time but are platform/admin noise, not app hot paths.*

### Top by call volume (app tables)

| Calls | Mean (ms) | Table / pattern |
|-------|-----------|-----------------|
| 3,389 | 1.54 | `clinic_members` |
| 2,918 | 0.65 | `clinics` |
| 1,891 | 0.02 | `clinic_member_permissions` |
| 693 | 0.07 | `profiles` |

### EXPLAIN (ANALYZE, BUFFERS) — synthetic staging clinic

Clinic UUID: `a0000000-0000-4000-8000-000000000001` (non-PHI fixture)

| Query name | Plan | Execution (ms) | Shared hit | Shared read |
|------------|------|----------------|------------|-------------|
| `clinical_records_by_clinic_patient` | **Limit** → Index Scan | **0.093** | 2 | 0 |
| `patients_list_by_clinic` | **Limit** → Index Scan | **0.204** | 7 | 0 |
| `appointments_agenda_day` | **Limit** → Index Scan | **0.122** | 4 | 0 |

**Index usage:** No sequential scans on tenant-filtered limit queries at page 1. Deep OFFSET on historias list remains a separate concern (see Remaining risks).

---

## 3. SELECT * findings and fixes

### Before

Phase 1 flagged wildcard `.select()` / `.select("*")` on import, clinical insert return, billing, cash, and admin document paths.

### After (explicit column lists)

| File | Columns constant | Why it mattered |
|------|------------------|-----------------|
| `src/features/historias/services/clinical-records.service.ts` | `CLINICAL_RECORD_INSERT_RETURN_COLUMNS` | Insert fallback returns wide rows on every save |
| `src/features/integraciones/actions/patient-import-session.ts` | `DATA_IMPORT_SESSION_COLUMNS` | Import session reread on every batch step |
| `src/features/integraciones/actions/fhir-import-session.ts` | `DATA_IMPORT_SESSION_COLUMNS` | Same |
| `src/core/billing/subscription-service.ts` | `CLINIC_SUBSCRIPTION_COLUMNS` | Billing page load |
| `src/lib/actions/admin-documents.ts` | `PATIENT_ADMIN_DOCUMENT_RETURN_COLUMNS` | Upload return payload |
| `src/lib/actions/cash-register.ts` | `CASH_CLOSURE_RETURN_COLUMNS`, `CASH_INVOICE_RETURN_COLUMNS` | Caja mutations |
| `src/lib/actions/clinic-services.ts` | (existing payment columns) | Service payment return |

**Gate:** `tests/performance/no-select-star.test.ts` — 12 critical files, all pass.

**Measured impact:** Payload reduction is proportional to omitted JSONB/audit columns; no functional regression (same fields consumed by callers). Exact byte savings vary by row — primary win is avoiding PostgREST wide-row deserialization under concurrency.

---

## 4. N+1 findings and fixes

### Finding: bulk clinical export (P1)

| Aspect | Detail |
|--------|--------|
| **File** | `src/features/integraciones/server/build-bulk-clinical-export.ts` |
| **Bottleneck** | Sequential `for` loop calling `loadPatientExportPackage` per patient; each call also fetched clinic professionals |
| **Before** | O(n) sequential round trips; n × professional list query |
| **After** | `mapWithConcurrency(..., 4)` + shared `professionalName` map hoisted once |
| **Helper** | `src/features/integraciones/lib/async-pool.ts` |

### Supporting change

| File | Change |
|------|--------|
| `load-patient-export-package.ts` | Accepts optional `PatientExportLoadContext.professionalName` to skip repeated `getCachedClinicProfessionalsList` |

**Before (pattern):** 50 patients → ~50 sequential export loads + up to 50 professional list fetches.  
**After:** 50 patients → 13 concurrent batches (concurrency 4) + **1** professional list fetch.

**Regression check:** `tests/clinical-export-phase2.test.ts` — pass.

---

## 5. Unbounded queries and pagination

### Verified bounded paths

| Path | Limit / pagination | File |
|------|-------------------|------|
| Patient EHR load-more | Cursor + `PATIENT_EHR_RECORD_PAGE_SIZE` | `load-more-patient-clinical-records.ts` |
| Historias clinic list | `HISTORIAS_PAGE_SIZE` + `.range()` | `load-historias-page.ts` |
| Bulk export patients | `bulkExportPatientCap()` | `select-bulk-export-patients.ts` |
| Single-patient export records | `PATIENT_EHR_PRINT_MAX_RECORDS` (500) | `load-patient-export-package.ts` |
| Import preview / FHIR prepare | `.limit(2000)` | `prepare-patient-import.ts`, `prepare-fhir-import.ts` |
| Import/export history | `.limit(1..80)` | `load-import-export-history.ts` |

### Remaining pagination concern (P1, not fixed in Phase 2)

| Path | Issue | Priority |
|------|-------|----------|
| `load-historias-page.ts` | OFFSET pagination on `clinical_records` — pg_stat mean **~320 ms** at depth | **P1** |
| Recommendation | Phase 3+ cursor-based historias pagination keyed on `(created_at, id)` | P1 |

No new unbounded queries introduced. Critical user-facing paths retain caps.

---

## 6. Round-trip reductions

| Optimization | Round trips saved |
|--------------|-------------------|
| Bulk export concurrency | ~(n−1) sequential waits → parallel batches |
| Shared professional map | ~(n−1) `getCachedClinicProfessionalsList` calls per bulk job |
| Explicit column lists | Smaller responses → lower PostgREST/JSON parse time under load |

---

## 7. Indexes (no new migrations in Phase 2)

Existing tenant-aware indexes validated for hot paths:

| Index | Migration | Used by |
|-------|-----------|---------|
| `idx_clinical_records_clinic_created` | 054 | Historias list, clinic-wide record queries |
| `idx_clinical_records_clinic_patient_created` | 046 | Patient EHR, export |
| `idx_clinical_records_clinic_lifecycle` | 131 | Active-record filters |

**Decision:** No new indexes added — EXPLAIN on synthetic staging data shows index scans at limit 25; adding indexes without evidence of seq scans would violate Phase 2 scope.

---

## 8. RPC / RLS verification

- **RLS static gate:** `tests/rls-policies.test.ts`, `tests/phase19-infrastructure.test.ts`, `tests/schema-validation.test.ts` — **23/23 pass**
- **Schema validation:** `npm run validate:schema` — **pass** (169 migrations)
- **No RPC signatures or policies modified** in Phase 2
- **No tenant leak vectors introduced** — all touched queries retain `clinic_id` filters or RPC wrappers

---

## 9. Before / after measurements

| Metric | Before (Phase 1 / pg_stat) | After (Phase 2) | Notes |
|--------|---------------------------|-----------------|-------|
| pg_stat_statements | Not documented | **Enabled + scripted** | Repeatable via `staging-query-performance.mjs` |
| Bulk export patient load | Sequential N+1 | **Concurrency 4 + shared context** | Structural fix; live latency TBD in Phase 7 load test |
| SELECT * on hot paths | 8+ files flagged | **0** in gated file list | `no-select-star.test.ts` |
| EXPLAIN page-1 clinical_records | Not measured | **0.09 ms**, Index Scan | Synthetic clinic, limit 25 |
| Historias OFFSET query | ~320 ms mean (142 calls) | **Unchanged** | Tracked as P1; needs cursor pagination |
| Performance gate | — | **106/106 pass** | Includes dashboard first-paint |
| TypeScript / build | TS error on cash columns | **Clean** | `created_at` removed from closure columns |

---

## 10. Remaining risks and priority status

### P0 (unchanged from Phase 1 — not Phase 2 scope)

| ID | Finding | Status |
|----|---------|--------|
| BL-P0-1 | No authenticated k6/load test for 1,000 users | **Open** |
| BL-P0-2 | RPO ≤ 1 h not proven | **Open** |
| BL-P0-3 | Live cross-tenant JWT integration tests incomplete | **Open** |

### P1 (database / scale)

| ID | Finding | Status after Phase 2 |
|----|---------|----------------------|
| BL-P1-5 | SELECT * / N+1 on import/clinical | **Mitigated** (hot paths fixed; historias OFFSET remains) |
| BL-P1-6 | pg_stat_statements not enabled | **Closed** |
| DB-P1-1 | Historias OFFSET on `clinical_records` (~320 ms mean) | **Open** — cursor pagination recommended |
| DB-P1-2 | `clinic_members` 3,389 calls/session bootstrap | **Open** — acceptable mean (1.54 ms); monitor under load |

### P2

| ID | Finding | Status |
|----|---------|--------|
| DB-P2-1 | Studio/admin queries pollute pg_stat top lists | Informational — filter in dashboards |
| DB-P2-2 | Migration 156 not yet applied via db-push (extension pre-exists on staging) | Low risk — idempotent |

---

## 11. Validation results

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npm run typecheck` | ✅ Pass |
| ESLint (touched files) | `eslint … --max-warnings 0` | ✅ Pass |
| Unit — Phase 2 | `vitest run tests/database-scale-phase2.test.ts tests/clinical-export-phase2.test.ts` | ✅ Pass |
| Performance gate | `npm run performance:gate` | ✅ 106/106 |
| RLS static | `npm run test:rls:static` | ✅ 23/23 |
| Schema / migrations | `npm run validate:schema` | ✅ Pass |
| Build | `npm run build` | ✅ Pass |

---

## 12. Files changed (Phase 2)

**New**

- `supabase/migrations/156_staging_query_performance_extension.sql`
- `scripts/lib/staging-db-query.mjs`
- `scripts/staging-query-performance.mjs`
- `src/features/integraciones/lib/async-pool.ts`
- `tests/database-scale-phase2.test.ts`
- `docs/production-readiness/DATABASE-SCALE-REPORT.md`

**Modified**

- `src/core/supabase/select-columns.ts`
- `src/features/historias/services/clinical-records.service.ts`
- `src/features/integraciones/actions/patient-import-session.ts`
- `src/features/integraciones/actions/fhir-import-session.ts`
- `src/features/integraciones/server/build-bulk-clinical-export.ts`
- `src/features/integraciones/server/load-patient-export-package.ts`
- `src/core/billing/subscription-service.ts`
- `src/lib/actions/admin-documents.ts`
- `src/lib/actions/cash-register.ts`
- `src/lib/actions/clinic-services.ts`
- `tests/performance/no-select-star.test.ts`
- `tests/performance/dashboard-first-paint.test.ts`

---

## Phase 3 GO / NO-GO

**Decision: GO** — Phase 2 database scale hardening objectives are met for staging promotion prep. Proceed to Phase 3 (observability/SLO) **without skipping Phase 7 load testing** before any 1,000-user capacity claim.

**Conditions:**

1. Do not treat Phase 2 as proof of 1,000-user readiness (P0 load/RPO/JWT gaps remain).
2. Plan cursor pagination for historias list (DB-P1-1) before or during Phase 7 load test.
3. Re-run `node scripts/staging-query-performance.mjs` after sustained staging traffic to refresh pg_stat baselines.
