# Phase 7B — Clinical Write Load Validation

**Repository:** [guille6720/DrFlow](https://github.com/guille6720/DrFlow)  
**Branch:** `release/0.2.19-staging-promotion`  
**Target:** `https://drflow-app-git-release-0219-staging-promotion-guillermo-c-bmw.vercel.app`  
**App build:** `0.2.19` / `081f4fc`  
**k6:** `v1.0.0`  
**Scope:** Staging / preview only — **never production**  
**Report date:** 2026-08-29

---

## Executive summary

| Item | Result |
|------|--------|
| Phase 7B verdict | **PARTIAL PASS** |
| Authoritative write path | `POST /api/clinical-records/persist` → `update_clinical_record_atomic` |
| Synthetic dataset | 5 clinics · 15 professionals · 300 patients · 300 records · 100 appointments |
| Stages executed | 10, 25, 50, 100 **PASS**; 250 **FAIL** (p95); 500/750/1000 **NOT RUN** |
| **VERIFIED_WRITE_CAPACITY** | **100 VUs** |
| Write success (≤100 VU) | **100%** (0 failures) |
| Clinical write p95 @100 | **1314 ms** (&lt; 2000) |
| Clinical write p95 @250 | **2320 ms** (threshold breach — stop) |
| 429 / 5xx (executed stages) | **0 / 0** |
| Readback mismatches | **0** |
| Tenant / patient / audit | **PASS** post-load |
| Contention (10 VU hot-row) | **PASS** (999 writes, 100% success, 0 conflicts/429/5xx) |
| BL-P0-1 | **CLOSED** (nav 1000 VU operator evidence + write 100 VU measured) |
| BL-P0-2 | **DEFERRED / OPEN** (PITR unchanged) |
| Production release | **NO-GO** (BL-P0-2) |

---

## 1. Authoritative clinical write path

| Item | Value |
|------|--------|
| **Authoritative endpoint** | `POST /api/clinical-records/persist` |
| Implementation | `src/app/api/clinical-records/persist/route.ts` |
| Service | `createClinicalRecordEntry` / `updateClinicalRecordEntry` |
| **RPCs** | `create_clinical_record_atomic` / `update_clinical_record_atomic` |
| Patient identity lock | Migration `154` → `PATIENT_MISMATCH` |
| App ownership | `verifyClinicalRecordForeignKeys` |
| Clinic context | Cookie `drflow_clinic_id` + write roles |
| CSRF stand-in | Same-origin `Origin` / `Referer` |
| Optimistic locking | `record_version++`; **no** client If-Match (last-write-wins) |
| Audit | `clinical_record_audit` insert inside RPC |

### Tables modified

`clinical_records`, `clinical_record_audit`, child diagnosis/treatment sync tables; waiting-room path uses `update_waiting_room_status_atomic` / appointments.

**Prescription issuance excluded** from load mix (regulated).

---

## 2. Synthetic dataset

Seed: `node scripts/phase7b-seed-write-fixtures.mjs`

| Entity | Count | Naming |
|--------|------:|--------|
| Clinics | 5 | `LOADTEST_CLINIC_00N` |
| Professionals | 15 | `LOADTEST_PROFESSIONAL_*` |
| Patients | 300 | `LOADTEST` / `PATIENT_*` |
| Clinical records | 300 | SOAP synthetic strings |
| Appointments | 100 | notes `LOADTEST_PHASE7B` |

Manifest: `coverage/load/clinical-write-fixtures.json` (IDs only).

---

## 3. Authentication

| Mechanism | Result |
|-----------|--------|
| `phase7b-mint-session-pool.mjs` | 5 clinic-scoped sessions |
| Pool file | `e2e/.phase7b-session-pool.json` (**gitignored**) |
| Cookie printing | Never |

Smoke persist before load: HTTP 200, `success: true`, `v: clinical-persist-v1`.

---

## 4. Write mix & think time

| Weight | Operation |
|--------|-----------|
| 50% | SOAP clinical save |
| 15% | Consultation update |
| 10% | Diagnosis write |
| 10% | Waiting-room status |
| 10% | Extra SOAP (Rx slot unused) |
| 5% | Health ready |

Think time: clinical 2–8s · consultation 3–10s · diagnosis 2–6s · appointment 1–4s.

---

## 5. Live write stages (measured)

| Stage | Status | Attempts | Success rate | http_req_failed | write p95 (ms) | 429 | 5xx | readback mm |
|------:|--------|--------:|-------------:|----------------:|---------------:|----:|----:|------------:|
| 10 | **PASS** | 87 | 100% | 0% | 1647 | 0 | 0 | 0 |
| 25 | **PASS** | 372 | 100% | 0% | 1350 | 0 | 0 | 0 |
| 50 | **PASS** | 1070 | 100% | 0% | 1211 | 0 | 0 | 0 |
| 100 | **PASS** | 3438 | 100% | 0% | 1314 | 0 | 0 | 0 |
| 250 | **FAIL** | 7920 | 100% | 0% | **2320** | 0 | 0 | 0 |
| 500 | NOT RUN | — | — | — | — | — | — | — |
| 750 | NOT RUN | — | — | — | — | — | — | — |
| 1000 | NOT RUN | — | — | — | — | — | — | — |

**Stop reason @250:** `clinical_write_duration` p95 &gt; 2000 ms (threshold). Success rate remained 100% with 0×429/5xx — latency bottleneck, not error storm.

**VERIFIED_WRITE_CAPACITY: 100 VUs**

Note: k6 summary exports for these runs did not include `p(99)` (fixed for future via `summaryTrendStats`). Observed **max** write durations: 10VU 2167 · 100VU 2314 · 250VU 5071 ms.

Evidence JSON: `coverage/load/write-{10,25,50,100,250}vu.json`

---

## 6. Contention test

| Metric | Value |
|--------|-------|
| VUs | 10 on 3 hot records |
| Attempts | 999 |
| Success | 100% |
| p95 | 1195 ms |
| Conflicts / 429 / 5xx | 0 / 0 / 0 |
| Result | **PASS** (safety probe — not capacity) |

Evidence: `coverage/load/write-contention.json`

No lost-update detector beyond last-write-wins (by design — no If-Match). Concurrent updates succeeded; `record_version` continues to increment (sampled in post-validation).

---

## 7. Post-load validation

| Check | Result |
|-------|--------|
| Audit trail (25 samples) | **0 missing** |
| Synthetic diagnosis readback | 25/25 |
| Tenant mismatch | 0 |
| Cross-clinic record leak | 0 |
| `qa-staging-patient-mismatch-auth.mjs` | **PASS** |
| `npm run test:rls:live` | **PASS** (6 tests) |

Evidence: `coverage/load/write-post-validation.json`

---

## 8. Navigation / soak context (Phase 7)

Operator-reported (not re-executed in 7B):

- App capacity 10→1000 VU **PASS** (0% errors, 0×429/5xx, p95 ~75 ms, p99 ~390 ms)
- Spike 100→1000→100 **PASS**
- Soak 250 VU / 30 min **PASS** (p95 ~77 ms, p99 ~398 ms)

### 16.6 s soak outlier

Isolated ~16.6 s request during soak. **No systemic impact** (overall p95/p99 healthy). Likely cold-start / transient upstream latency; correlation ID / Vercel–Supabase breakdown **not available** in this workspace’s soak artifacts. Classified **P2 observation**, not a write-capacity blocker.

---

## 9. Bottleneck

| Finding | Detail |
|---------|--------|
| Main bottleneck | Clinical persist **latency** under ≥250 concurrent write VUs (p95 2.3 s, max ~5 s) |
| Not observed | Error storms, 429 saturation, 5xx, RLS/audit failure |
| Likely contributors | Vercel function duration + DB row lock/`FOR UPDATE` + post-RPC patches + HTML readback cost |
| Fixes in 7B | Pagination contract already fixed in Phase 7; write suite + fixtures + metrics; **no speculative architecture rewrite** |

---

## 10. Remaining P0 / P1

| ID | Status |
|----|--------|
| **BL-P0-2** | **DEFERRED / OPEN** — PITR off; RPO ≤1h unproven |
| P7B-P1-1 | Write p95 degrades above 100 VU — optimize persist path if higher write concurrency required |
| P6-P1-1 | Warm navigation &gt;1 s (prior) |
| P7B-P2-1 | Documented 16.6 s soak outlier |

---

## 11. BL-P0-1 closure language

**CLOSED** with explicit distinction:

> DrFlow has demonstrated **1000 concurrent authenticated application VUs** for the tested navigation/read workload (operator Phase 7 evidence), with **clinical write concurrency separately verified up to 100 VUs** on synthetic staging data via `POST /api/clinical-records/persist` (100% success, p95 &lt; 2 s, 0×429/5xx, tenant/patient/audit intact).

Do **not** claim: “1000 users can simultaneously save clinical histories.”

---

## 12. GO / NO-GO

**NO-GO** for production release while **BL-P0-2** remains open (PITR / RPO).

Phase 7B write-capacity evidence is acceptable for closing BL-P0-1 under the dual-capacity wording above.
