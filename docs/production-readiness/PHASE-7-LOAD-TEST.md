# Phase 7 — Professional K6 Load Test + Bottleneck Remediation

**Repository:** [guille6720/DrFlow](https://github.com/guille6720/DrFlow)  
**Branch:** `release/0.2.19-staging-promotion`  
**Commit:** `c9e9f3473d1985ae5a52278bf5474889f0910898` (suite: `00fc6700`)  
**Report date:** 2026-08-28  
**Scope:** Staging/preview only — **production (`drflow.opusorg.com`) never load-tested**

---

## Executive summary

Phase 7 prepared the professional k6 suite and fixed the Phase 6 pagination contract bug. **Live 10→1000 VU capacity runs were NOT executed** because Step 0 pre-flight failed closed:

| Gate | Result |
|------|--------|
| Distributed Redis rate limit | **FAIL** — `distributedRateLimitActive: false` (memory fallback only) |
| k6 installed | ✅ `k6.exe v1.0.0` (`tools/k6.exe`) |
| Staging/preview health | ✅ preview ready (`ok: true`) |
| Staging Supabase | ✅ `gprmsufvhabntbrytwyi` |
| Session cookie for app capacity | **FAIL** — `K6_SESSION_COOKIE` missing |
| Production URL protection | ✅ scripts refuse `drflow.opusorg.com` |

**Per instructions: memory fallback is not accepted for scalability evidence. Escalation STOPPED.**

| Item | Status |
|------|--------|
| **BL-P0-1** | **OPEN** — 1 000 VU capacity not measured |
| **BL-P0-2** | **DEFERRED / OPEN** — unchanged |
| Verified capacity | **N/A** (no valid load stage completed) |
| Phase 7 → production release | **NO-GO** |

Evidence: `coverage/load/phase7-preflight.json`

---

## 1. Test environment (intended)

| Field | Value |
|-------|-------|
| Preview target probed | `drflow-6fvvxx581-guillermo-c-bmw.vercel.app` |
| Production (blocked) | `drflow.opusorg.com` |
| Supabase staging | `gprmsufvhabntbrytwyi` |
| App version on preview | `0.2.19` / buildId `80f6a1a` |
| k6 version | `v1.0.0 (windows/amd64)` |
| Redis RL on staging/preview | **Not configured** (Vercel env scan: no UPSTASH_*) |

---

## 2. Step 0 — Pre-flight blockers (detail)

### MANUAL INFRA ACTION REQUIRED

1. Create Upstash Redis database (or equivalent REST Redis).
2. Set on **staging/preview** Vercel project (and local `.env.local` for preflight):
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Redeploy staging/preview so `checkRateLimitAsync` uses Redis.
4. Re-run: `node scripts/phase7-load-preflight.mjs --base-url=<preview>`
5. Confirm JSON: `"distributedRateLimitActive": true`
6. Mint `K6_SESSION_COOKIE` from synthetic staging QA user (never commit).
7. Re-run validation stages 10 → 25 → 50 before any ramp.

---

## 3. Pagination correctness fix (Step 1)

### Bug (Phase 6)

Deep `?page=N` without cursor **silently returned page-1 rows** after clamping `effectivePage = 1`.

### Fix

| Case | Behavior |
|------|----------|
| Invalid `cursor` / `before` | `paginationMode: invalid_cursor`, **empty records**, user-facing error |
| `page > 3` without cursor | `paginationMode: cursor_required`, **empty records**, error + link home |
| Pages 2–3 without cursor | Shallow OFFSET fallback (legacy) |
| Cursor/before present | Keyset `(created_at DESC, id DESC)` |

UI: `EmptyState` “Paginación no disponible” + Volver al inicio.  
Tests: `tests/load-phase7.test.ts`

---

## 4. Authentication strategy (prepared)

| Mode | Script | Auth |
|------|--------|------|
| Application capacity | `load/k6/app-capacity.js` | `K6_SESSION_COOKIE` required |
| Auth capacity | `load/k6/auth-capacity.js` | `K6_AUTH_EMAIL` / `K6_AUTH_PASSWORD` (separate, low VU) |

Anonymous app load **aborts** in `setup()`.

---

## 5. Traffic model (prepared, not executed)

| Weight | Journey |
|--------|---------|
| 35% | Dashboard |
| 20% | Patient list + search |
| 15% | Patient workspace |
| 10% | Clinical history (keyset) |
| 10% | Appointments + waiting room |
| 5% | Consultation reads |
| 5% | Health ready |

Think time: nav 0.5–2s · read 1–4s · clinical 2–8s (`load/k6/lib/scenarios.js`).

Safe writes deferred until dedicated CSRF + synthetic write fixtures via env.

---

## 6. Dataset

Uses existing staging synthetic fixtures (Phase 3/5/6). Full multi-clinic expansion for 1k VU remains an operator task once Redis + cookies are ready. Documented in `load/k6/README.md`.

---

## 7–11. Live results

| Stage | Status |
|-------|--------|
| 10 / 25 / 50 VU | **NOT RUN** — preflight blocked |
| 100 / 250 / 500 / 750 / 1000 | **NOT RUN** |
| Spike | **NOT RUN** |
| Soak | **NOT RUN** |
| Auth capacity | **NOT RUN** |

Per-operation p95/p99, error/429/5xx distributions: **N/A**

---

## 12. Warm navigation (P6-P1-1)

No new load evidence. Prior measurement ~1.7–2.6s remains. Bottleneck still attributed to dashboard shell / entitlements (Phase 6). **Not improved in Phase 7** (no valid load correlation).

---

## 13. Bottlenecks / fixes this phase

| Item | Action |
|------|--------|
| Silent deep-page clamp | **Fixed** + tests |
| Redis RL missing | **Blocker** — infra action required |
| Session cookie missing | **Blocker** — operator mint required |
| k6 missing | **Fixed** — `tools/k6.exe` v1.0.0 (gitignored binary) |

---

## 14. Scripts delivered

```
load/k6/app-capacity.js
load/k6/auth-capacity.js
load/k6/spike.js
load/k6/soak.js
load/k6/lib/metrics.js
load/k6/lib/auth.js
load/k6/lib/scenarios.js
scripts/phase7-load-preflight.mjs
```

---

## 15. Remaining P0 / P1

| ID | Status |
|----|--------|
| **BL-P0-1** | **OPEN** |
| **BL-P0-2** | **DEFERRED / OPEN** |
| P7-P0-1 | Upstash Redis not on staging/preview |
| P7-P0-2 | `K6_SESSION_COOKIE` not provided |
| P6-P1-1 | Warm nav > 1s |
| P7-P1-1 | Synthetic write journey not yet wired |
| P7-P1-2 | Multi-clinic dataset expansion for 1k VU |

---

## 16. BL-P0-1 closure

**OPEN** — none of the closure criteria (1k VU reached with thresholds) were measured.

## 17. BL-P0-2

**DEFERRED / OPEN** — PITR not modified.

## 18. GO / NO-GO

**NO-GO** for production release and for claiming 1 000-user capacity.

**Unblock path:** Redis on staging → session cookie → `phase7-load-preflight` PASS → 10/25/50 → progressive ramp.

---

## Validation executed (non-load)

| Gate | Result |
|------|--------|
| Preflight | Exit 2 (expected blockers recorded) |
| Preview `/api/health/ready` | ✅ |
| Unit tests Phase 7 pagination/k6 structure | run at commit time |
| Production load | **Not attempted** |
