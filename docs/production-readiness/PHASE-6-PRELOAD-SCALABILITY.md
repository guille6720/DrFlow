# Phase 6 — Pre-Load Scalability Hardening

**Repository:** [guille6720/DrFlow](https://github.com/guille6720/DrFlow)  
**Branch:** `release/0.2.19-staging-promotion`  
**Scope:** Staging-first; production not modified  
**Report date:** 2026-08-28  
**References:** [PHASE-1-BASELINE.md](./PHASE-1-BASELINE.md), [DATABASE-SCALE-REPORT.md](./DATABASE-SCALE-REPORT.md), [PHASE-3-TENANT-ISOLATION.md](./PHASE-3-TENANT-ISOLATION.md), [PHASE-4-OBSERVABILITY-SLO.md](./PHASE-4-OBSERVABILITY-SLO.md), [PHASE-5-DISASTER-RECOVERY.md](./PHASE-5-DISASTER-RECOVERY.md)

---

## Executive summary

Phase 6 removes known pre-load scalability risks before the Phase 7 1 000-VU k6 run: **historias keyset pagination**, **distributed-capable rate limiting**, **request-scoped Supabase client**, **bounded retention/waiting-room queries**, and a **validated k6 script structure** (10/25/50 stages).

| Exit criterion | Status |
|----------------|--------|
| DB-P1-1 OFFSET → keyset | ✅ Keyset + shallow OFFSET fallback (≤ page 3) |
| Distributed rate limiting | ✅ Redis abstraction + memory fallback |
| Session / `createClient` dedup | ✅ `React.cache` request-scoped client |
| Critical unbounded queries | ✅ Retention + sala-espera capped |
| Warm navigation | ⚠ Understood; partial improvement via client dedup |
| 10/25/50 VU live | ⚠ Script ready; **k6 binary not installed in CI/dev** |
| k6 script validated | ✅ Structure + metrics tests |
| No security/RLS regression | ✅ Gates green |
| **BL-P0-2** | **DEFERRED / OPEN** (intentionally) |
| **BL-P0-1** | **OPEN** (Phase 7) |

**Phase 6 verdict:** **GO** to Phase 7 (1 000-VU capacity), with BL-P0-2 remaining deferred/open and live 10/25/50 runs required once k6 + staging cookie are available.

---

## 1. OFFSET pagination before / after (DB-P1-1)

### Before

`load-historias-page.ts` used `.range(from, to)` for every page. Phase 2 `pg_stat_statements`: **~320 ms mean**, 142 calls, OFFSET on `clinical_records`.

### After

| Mode | Behavior |
|------|----------|
| Page 1 / keyset | `ORDER BY created_at DESC, id DESC LIMIT 26` |
| Next | `cursor=created_at\|id` + PostgREST tuple filter |
| Prev | `before=created_at\|id` (ASC then reverse) |
| Shallow fallback | OFFSET only for pages **2–3** (`KEYSET_OFFSET_FALLBACK_MAX_PAGE`) |
| Deep page without cursor | Clamped to page 1 (no deep OFFSET) |

Clinic isolation (`.eq("clinic_id")`) and patient search filters preserved. Index: `idx_clinical_records_clinic_created`.

### Staging EXPLAIN (`npm run phase6:historias:explain`)

Synthetic clinic `a0000000-…0001` (few rows — times are not load-comparable to Phase 2 production-like stats):

| Query | Execution (ms) | Plan |
|-------|----------------|------|
| keyset page 1 | 0.148 | Limit → Index Scan (`idx_clinical_records_clinic_created`) |
| OFFSET 975 | 0.154 | Same index (tiny dataset) |
| keyset after cursor | 0.242 | Index Scan + filter |

Evidence: `coverage/phase6-historias-pagination-explain.json`

**Write-cost:** no new indexes added.

---

## 2. Rate-limit architecture

| Layer | Implementation |
|-------|----------------|
| Core | `src/core/security/rate-limit.ts` — `checkRateLimitAsync` |
| Backends | **Redis** (Upstash REST) when env set; else **memory** per instance |
| Auth | login + reset-password (async) |
| Search | `/api/patients/search` — 90/min user+IP |
| AI | `/api/clinical-ai` — 40/min clinic+IP |
| Public API | `checkPublicApiRateLimit` — 120/min keyId (async) |

### Env vars (no secrets in git)

```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
# aliases:
RATE_LIMIT_REDIS_REST_URL
RATE_LIMIT_REDIS_REST_TOKEN
```

Without Redis: documented multi-instance gap remains (fallback). Staging should set Upstash before 1k VU.

---

## 3. Session / query deduplication

| Change | Effect |
|--------|--------|
| `createClient` wrapped in `React.cache` | One server client per RSC request tree |
| Existing `cache()` on getSession / getUserClinics / getDashboardShell | Unchanged — auth not cached beyond request |

`clinic_members` ~3389 calls (Phase 2) remain request-scoped; volume under 1k users still depends on shell fan-out. Device-session touch on warm nav is unchanged (safety).

---

## 4. Critical route timings (qualitative)

| Flow | Notes |
|------|-------|
| Login | Rate-limited; device session claim |
| Dashboard | Shell: session + clinics + entitlements + features |
| Patient list | Paginated (`PACIENTES_PAGE_SIZE`) |
| Patient search | API rate limit + query limits |
| Historias | **Keyset** (this phase) |
| Appointments | Agenda max caps |
| Waiting room | **`.limit(TURNOS_TODAY_SCAN_MAX)`** added |
| Clinical AI | Rate limit + entitlements |
| Bulk export | Phase 2 async-pool |

No speculative micro-opts beyond P0/P1 above.

---

## 5. Warm navigation before / after

| Metric | Before (Phase 1) | After Phase 6 |
|--------|------------------|---------------|
| Warm nav p95 target | < 1000 ms | **Not fully met** |
| Observed | ~1.7–2.6 s median (Playwright) | Client factory deduped; shell still heavy |

**Bottleneck (measured understanding):** browser → Next.js RSC → `dashboard-data-shell` (session + clinics + entitlements + features + providers) → page loader → serialize → client hydrate.

**Best realistic result without major architecture change:** reduce redundant `createClient()`; further gains need deferred entitlements/features on warm paths (tracked P1).

---

## 6. Query bounds

| Path | Fix |
|------|-----|
| Retention summary | Oldest/newest via `.limit(1)` — no full `created_at` scan |
| Sala espera | `.limit(TURNOS_TODAY_SCAN_MAX)` |
| Historias | Keyset / capped OFFSET |

---

## 7. Index changes

**None added.** Existing `idx_clinical_records_clinic_created` / `clinic_patient_created` sufficient for keyset plans (EXPLAIN Index Scan).

---

## 8. Connection-pressure analysis

| Concurrent users | Risk |
|------------------|-----|
| 100 | Low — serverless + Supabase pooler |
| 250 | Moderate — ensure Redis rate limits + pooler |
| 500–1000 | High without: (1) Redis RL, (2) session cookie pool (no login storm), (3) no new client per sub-query |

Mitigations shipped: request-scoped client; rate limits on expensive APIs. Long transactions: none introduced.

---

## 9. Payload reductions

Retention summary no longer pulls all clinical `created_at` rows into the app. Historias select list unchanged (already explicit columns).

---

## 10. Realtime scaling

| Module | Channels / user |
|--------|-----------------|
| Clinical ops dashboard | 1 (`clinical-ops-{clinicId}`) — 3 table filters |
| Waiting room | 1 (`waiting-room-{clinicId}`) |
| Cleanup | `removeChannel` on unmount |

**Expected:** ≤ ~2 channels per active clinician session. 1 000 users ≈ ≤ 2 000 channels if all leave ops + waiting room open — monitor Supabase Realtime quotas before Phase 7.

---

## 11. Pre-load 10 / 25 / 50 VU results

| Stage | Result |
|-------|--------|
| Script | `load/k6/app-capacity.js` |
| Metrics | 2xx/3xx/4xx/429/5xx, timeout, network, p95 thresholds |
| Live run | **NOT EXECUTED** — `k6` not installed in this environment |
| Unit validation | ✅ `tests/preload-scalability-phase6.test.ts` |

Operator command once k6 + cookie available:

```bash
k6 run -e BASE_URL=https://<staging> -e K6_SESSION_COOKIE='...' -e STAGE=10 load/k6/app-capacity.js
```

---

## 12. k6 data strategy

See `load/k6/README.md` — multi-clinic synthetic distribution; avoid single-row hotspots.

---

## 13. Auth strategy

| Mode | Use |
|------|-----|
| `MODE=app` | Session cookie pool — **application** capacity |
| `MODE=auth` | Password login — **auth** capacity only (separate) |

Credentials via env only — never committed.

---

## 14. Remaining P0 / P1

| ID | Item | Status |
|----|------|--------|
| **BL-P0-1** | 1 000-VU k6 evidence | OPEN → Phase 7 |
| **BL-P0-2** | RPO ≤ 1 h / PITR restore | **DEFERRED / OPEN** |
| P6-P1-1 | Warm nav p95 still > 1 s | OPEN |
| P6-P1-2 | Redis rate-limit env not set on staging | OPEN |
| P6-P1-3 | Live 10/25/50 VU not run (k6 missing) | OPEN |
| P6-P1-4 | Clinic_members call volume under load | Monitor in Phase 7 |

---

## 15. Deferred BL-P0-2 status

**OPEN / DEFERRED.** Phase 5 documented PITR disabled (`pitr_enabled: false`). Phase 6 did **not** enable PITR, did **not** claim RPO ≤ 1 h, and does **not** claim final production readiness.

---

## 16. GO / NO-GO for Phase 7

**GO** for Phase 7 (1 000-user k6), contingent on:

1. Install/run k6 10/25/50 against staging with session cookies  
2. Configure Upstash Redis for rate limits on staging  
3. Keep BL-P0-2 deferred until infra enables PITR  

Do **not** close BL-P0-1 from Phase 6 alone.

---

## Validation executed

| Gate | Result |
|------|--------|
| `npm run typecheck` | ✅ |
| `npm run test:phase6` | ✅ 11/11 |
| `npm run test:rls:static` | ✅ 23/23 |
| `npm run security:gate` | ✅ |
| `npm run performance:gate` | ✅ |
| `npm run phase6:historias:explain` | ✅ |
| Build | run before commit if time permits |
