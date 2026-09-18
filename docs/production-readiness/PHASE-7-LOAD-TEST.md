# Phase 7 — Professional K6 Load Test + Bottleneck Remediation

**Repository:** [guille6720/DrFlow](https://github.com/guille6720/DrFlow)  
**Branch:** `release/0.2.19-staging-promotion`  
**Companion:** [`PHASE-7B-CLINICAL-WRITE-LOAD.md`](./PHASE-7B-CLINICAL-WRITE-LOAD.md)  
**Report date:** 2026-08-29  
**Scope:** Staging/preview only — **production (`drflow.opusorg.com`) never load-tested**

---

## Executive summary

| Workload | Verified capacity | Notes |
|----------|-------------------|-------|
| Authenticated navigation / read | **1000 VUs** (operator Phase 7 evidence) | Spike + 30 min soak also PASS |
| Clinical writes (`/api/clinical-records/persist`) | **100 VUs** (Phase 7B measured) | 250 VU failed p95 &gt; 2 s — stopped |

| Item | Status |
|------|--------|
| **BL-P0-1** | **CLOSED** (dual-capacity wording — see §BL-P0-1) |
| **BL-P0-2** | **DEFERRED / OPEN** — PITR not enabled; RPO ≤1h not proven |
| Production release | **NO-GO** |

---

## Navigation / read capacity (operator evidence)

| Stage | Result |
|------:|--------|
| 10 / 25 / 50 / 100 / 250 / 500 / 750 / 1000 | **PASS** |
| 1000 VU sustained | 0% errors · 0×429 · 0×5xx · p95 ~75 ms · p99 ~390 ms |
| Spike 100→1000→100 | **PASS** |
| Soak 250 VU / 30 min | **PASS** · p95 ~77 ms · p99 ~398 ms |

### 16.6-second soak outlier

One isolated ~16.6 s request during soak. Overall percentiles remained healthy. Treated as **P2 observation** (likely cold start / transient). Correlation ID / provider traces not present in this workspace’s soak exports.

---

## Clinical write capacity (Phase 7B measured)

Target: `drflow-app-git-release-0219-staging-promotion-guillermo-c-bmw.vercel.app` · build `081f4fc`

| Stage | Status | Attempts | Success | p95 write (ms) | 429 | 5xx |
|------:|--------|--------:|--------:|---------------:|----:|----:|
| 10 | PASS | 87 | 100% | 1647 | 0 | 0 |
| 25 | PASS | 372 | 100% | 1350 | 0 | 0 |
| 50 | PASS | 1070 | 100% | 1211 | 0 | 0 |
| 100 | PASS | 3438 | 100% | 1314 | 0 | 0 |
| 250 | **FAIL** (p95) | 7920 | 100% | **2320** | 0 | 0 |
| 500+ | NOT RUN | | | | | |

**VERIFIED_WRITE_CAPACITY: 100 VUs**

Contention (10 VU / 3 hot rows): PASS · 999 writes · 100% · p95 1195 ms · 0 conflicts.

Post-load: audit OK · patient mismatch PASS · live RLS PASS · 0 tenant leaks.

Full detail: `PHASE-7B-CLINICAL-WRITE-LOAD.md`.

---

## Pagination fix (earlier Phase 7)

Deep historias pages without cursor return controlled `cursor_required` / `invalid_cursor` — **no silent page-1**.

---

## BL-P0-1

**CLOSED** with distinction:

> 1000 concurrent authenticated **application** VUs demonstrated for navigation/read; clinical **write** concurrency verified separately to **100 VUs**.

## BL-P0-2

**DEFERRED / OPEN** — do not modify PITR in this phase.

---

## Remaining priorities

| ID | Item |
|----|------|
| BL-P0-2 | Enable PITR + prove RPO ≤1h |
| P7B-P1-1 | Persist latency above 100 write VUs |
| P6-P1-1 | Warm navigation &gt;1 s |
| P7B-P2-1 | 16.6 s soak outlier |

---

## GO / NO-GO

**NO-GO** for production until BL-P0-2 is closed.
