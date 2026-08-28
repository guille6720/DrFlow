# Phase 3 — Live Tenant Isolation + Clinical Data Safety

**Repository:** [guille6720/DrFlow](https://github.com/guille6720/DrFlow)  
**Branch:** `release/0.2.19-staging-promotion`  
**Scope:** Staging only (`gprmsufvhabntbrytwyi`) — **production not modified**  
**Report date:** 2026-08-28  
**References:** [PHASE-1-BASELINE.md](./PHASE-1-BASELINE.md), [DATABASE-SCALE-REPORT.md](./DATABASE-SCALE-REPORT.md)

---

## Executive summary

Phase 3 closes **BL-P0-3** by proving **runtime tenant and patient isolation** with **real authenticated JWT sessions** against staging. Fourteen live probes passed (User A ↔ Clinic B and inverse User B ↔ Clinic A). Patient mismatch (`PATIENT_MISMATCH`) is enforced on atomic clinical RPC without mutation. Storage paths for Clinic B are not listable or signable by User A. Authorized clinical updates produce audit rows with correct `clinic_id`, `patient_id`, and `clinical_record_id`.

**No P0 tenant leak detected.** RLS, RBAC, and audit gates were not weakened.

| Exit criterion | Status |
|----------------|--------|
| No cross-clinic read | ✅ 14/14 probes |
| No cross-clinic write | ✅ UPDATE/DELETE/RPC denied |
| No patient mismatch mutation | ✅ PATIENT_MISMATCH + unchanged row |
| No cross-clinic file access | ✅ signed URL + list denied |
| Rapid A/B switching (Playwright) | ✅ Spec added; same pattern as release gate |
| Audit trail on authorized mutation | ✅ `clinical_record_audit` verified |
| Repeatable staging tests | ✅ Scripted + CI workflow |
| Regression gates | ✅ RLS static, typecheck, build, live JWT vitest |

**Phase 3 verdict:** **GO** to Phase 4, with Playwright cross-clinic UI run recommended on each staging promotion (workflow_dispatch optional job).

---

## 1. Controlled test fixtures (synthetic, staging-only)

| Entity | Identity / marker | Clinic |
|--------|-------------------|--------|
| **Clinic A** | `a0000000-0000-4000-8000-000000000001` | Fixed seed clinic |
| **User A** | `drflow-release-qa@staging.drflow.invalid` | Member of Clinic A |
| **Patient A** | DNI `90060001`, synthetic name PortalA | Clinic A |
| **Clinical Record A** | Marker: `E2E Phase6 release gate synthetic HC` | Clinic A |
| **Clinic B** | Resolved via slug `mi-clinica-abuelitos` → `4fff7b18-ca33-4198-975f-10cf399602b7` | Distinct tenant |
| **User B** | `drflow-tenant-b-qa@staging.drflow.invalid` | Member of Clinic B |
| **Patient B** | DNI `90070001`, synthetic name TenantB | Clinic B |
| **Clinical Record B** | Marker: `E2E Phase3 tenant isolation synthetic HC (Clinic B)` | Clinic B |
| **Same-clinic Patient B** | DNI `90060002` (phase6 PortalB) | Clinic A — mismatch probes only |

**Setup scripts (staging only):**

```bash
node scripts/configure-staging-e2e-account.mjs
npm run phase6:seed:staging-e2e
node scripts/ensure-phase6-clinical-record.mjs
npm run phase3:seed:staging-tenant
npm run phase3:configure:tenant-b
npm run phase3:tenant-isolation:staging
```

**Env artifacts (gitignored):** `e2e/.phase3-tenant-env.local`, `e2e/.phase6-env.local`, credentials in `.env.local`.

---

## 2. Live JWT cross-tenant results

**Captured:** 2026-08-28T19:25:36Z · **Report:** `coverage/staging-tenant-isolation.json`

### User A (Clinic A member)

| Scenario | Table / RPC | Expected | Actual | Result |
|----------|-------------|----------|--------|--------|
| SELECT own patient | `patients` | Row with clinic A | `clinic=a000…0001` | ✅ PASS |
| SELECT Clinic B patient | `patients` | Zero rows | `null` | ✅ PASS |
| SELECT Clinic B record | `clinical_records` | Zero rows | `null` | ✅ PASS |
| UPDATE Clinic B patient | `patients` | No mutation | `rows=0` | ✅ PASS |
| DELETE Clinic B record | `clinical_records` | Record persists | `deleted=0 exists=true` | ✅ PASS |
| RPC on Clinic B | `update_clinical_record_atomic` | FORBIDDEN | `FORBIDDEN` | ✅ PASS |

### User B (Clinic B member) — inverse

| Scenario | Table | Expected | Actual | Result |
|----------|-------|----------|--------|--------|
| SELECT own patient | `patients` | Row with clinic B | `clinic=4fff7b18…` | ✅ PASS |
| SELECT Clinic A patient | `patients` | Zero rows | `null` | ✅ PASS |
| SELECT Clinic A record | `clinical_records` | Zero rows | `null` | ✅ PASS |

**Vitest live integration:** `npm run test:rls:live` — **6/6 pass** (`tests/cross-tenant-rls.integration.test.ts`).

---

## 3. Patient ID mismatch results

| Scenario | Mechanism | Expected | Actual | Mutation verified |
|----------|-----------|----------|--------|-------------------|
| Record A + Patient B `patient_id` (same clinic) | `update_clinical_record_atomic` | `PATIENT_MISMATCH` | `PATIENT_MISMATCH` | ✅ No field change |
| Cross-clinic RPC | `can_write_clinical(Clinic B)` | `FORBIDDEN` | `FORBIDDEN` | ✅ N/A |

Prior probe retained: `scripts/qa-staging-patient-mismatch-auth.mjs` — compatible with phase6 fixtures.

**Not separately probed at RPC layer (app-layer guarded):** prescriptions insert, medical_orders insert, attachment upload — static gates + `ownership-guard.ts` cover these; recommend adding live probes in Phase 7 load test if needed.

---

## 4. Rapid patient A/B switching (Playwright)

**Spec:** `e2e/tenant-isolation-staging.spec.ts`

| Test | Coverage |
|------|----------|
| Tab sequence A→SOAP→diagnoses→recetas→B→tabs→A | DNI/name isolation |
| Rapid A→B→A→B (6 steps) | `assertNoForbiddenFlash` (800ms window) |
| Cross-clinic URL | User A opens Clinic B patient URL — no TenantB DNI/PHI |

**Pattern reused from:** `e2e/release-gate-staging.spec.ts` (validated in Phase 1 release gate).

**Run (staging app URL):**

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/tenant-isolation-staging.spec.ts
```

*Note: Requires local/staging app + E2E credentials. CI optional job in `.github/workflows/staging-tenant-isolation.yml`.*

---

## 5. Storage isolation results

| Scenario | Operation | Expected | Actual | Result |
|----------|-----------|----------|--------|--------|
| User A signed URL for Clinic B path | `storage.createSignedUrl` | Denied | `Object not found` (no URL) | ✅ PASS |
| User A list Clinic B prefix | `storage.list` | Empty / denied | `count=0` | ✅ PASS |

Attachment metadata seeded in `patient_attachments` with path `{clinic_b}/{patient_b}/phase3-synthetic-attachment.txt`. No real PHI blob required — RLS evaluated before object fetch.

---

## 6. Audit trail results

| Scenario | Table | Expected | Actual | Result |
|----------|-------|----------|--------|--------|
| Authorized SOAP update (User A, Record A) | `clinical_record_audit` | Row with clinic_id, patient_id, clinical_record_id | `action=update` | ✅ PASS |
| Rejected mismatch | `clinical_records` | No row change | Unchanged snapshot | ✅ PASS |

Audit probe restores original `chief_complaint` after verification to avoid fixture drift.

---

## 7. CI automation

| Layer | Location | When |
|-------|----------|------|
| Static RLS | `npm run test:rls:static` in `.github/workflows/ci.yml` | Every PR |
| Live JWT staging | `.github/workflows/staging-tenant-isolation.yml` | `workflow_dispatch` + `environment: staging` |
| Playwright isolation | Same workflow, optional `run_playwright=true` | Manual |
| Vitest live | `npm run test:rls:live` | Staging workflow + local |

**Secrets (staging only, never production):** `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `STAGING_E2E_EMAIL`, `STAGING_E2E_PASSWORD`, `STAGING_E2E_TENANT_B_*`, `STAGING_APP_URL`.

Production ref guard in workflow: refuses URL containing production project ref.

---

## 8. Fixes applied in Phase 3

| Change | Purpose |
|--------|---------|
| `scripts/phase3-seed-staging-tenant-fixtures.mjs` | Cross-clinic synthetic fixtures |
| `scripts/configure-staging-tenant-b-account.mjs` | User B provisioning |
| `scripts/qa-staging-tenant-isolation.mjs` | 14 live JWT probes + JSON report |
| `tests/cross-tenant-rls.integration.test.ts` | Replaced service-role proxy with JWT tests |
| `e2e/tenant-isolation-staging.spec.ts` | Rapid A/B + cross-clinic URL |
| `.github/workflows/staging-tenant-isolation.yml` | Staging CI separation |

**No RLS policy weakening.** No security bypass added.

---

## 9. Remaining P0 / P1

### P0

| ID | Finding | Status after Phase 3 |
|----|---------|----------------------|
| BL-P0-1 | No k6/load test for 1,000 users | **Open** (Phase 7) |
| BL-P0-2 | RPO ≤ 1 h not proven | **Open** |
| BL-P0-3 | Live JWT cross-tenant tests | **Closed** ✅ |

### P1

| ID | Finding | Status |
|----|---------|--------|
| BL-P1-3 | Staging E2E not in default CI | **Mitigated** — optional staging workflow |
| BL-P1-11 / STO-2 | Runtime storage cross-tenant | **Closed** for signed URL + list |
| DB-P1-1 | Historias OFFSET pagination | **Open** (Phase 2) |
| Live probes for prescriptions/orders/attachments RPC | Not in Phase 3 scope | **P2** — track for Phase 7 |

### Pre-existing (unchanged)

| Gate | Note |
|------|------|
| `security:gate` | `dangerouslySetInnerHTML` in superadmin manual (pre-existing allowlist candidates) |

---

## 10. Validation results

| Check | Result |
|-------|--------|
| Live JWT probes | ✅ **14/14** |
| `npm run test:rls:live` | ✅ **6/6** |
| `npm run test:rls:static` | ✅ **23/23** |
| `tests/tenant-isolation-phase3.test.ts` | ✅ **8/8** |
| TypeScript | ✅ Pass |
| Build | ✅ Pass |
| Performance gate | ✅ 106/106 |
| Security gate | ⚠️ Pre-existing manual HTML warnings (not Phase 3 regressions) |

---

## Phase 4 GO / NO-GO

**Decision: GO** — BL-P0-3 is closed with repeatable staging evidence. Proceed to Phase 4 (observability / SLO wiring per plan) while tracking BL-P0-1/2 and optional Playwright job on each staging promotion.

**Do not** interpret Phase 3 as full 1,000-user production readiness without Phase 7 load testing.
