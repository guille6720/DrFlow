# Phase 6 — k6 load test data & auth strategy (staging synthetic only)

## Dataset design (synthetic)

| Entity | Target for Phase 7 (1k VU) | Pre-load (10/25/50) |
|--------|----------------------------|---------------------|
| Clinics | ≥ 3 synthetic clinics | 1–2 staging fixtures |
| Users / clinic | 5–20 professionals | existing QA accounts |
| Patients / clinic | ≥ 500 synthetic | existing Phase 3/5 fixtures |
| Clinical records | ≥ 2 000 distributed | historias keyset pages |
| Appointments | ≥ 200 upcoming | agenda day range |
| Prescriptions | optional | smoke only |

**Traffic distribution:** each VU randomly picks routes (dashboard, patients, historias, agenda, waiting room). Avoid all VUs hitting one patient UUID unless testing contention.

Seed helpers (existing):

- `npm run phase6:seed:staging-e2e`
- `npm run phase3:seed:staging-tenant`
- `npm run phase5:dr:seed`

## Auth strategy

| Mode | Purpose | How |
|------|---------|-----|
| `MODE=app` | Application capacity | Pre-issued `K6_SESSION_COOKIE` from a test user pool |
| `MODE=auth` | Auth capacity only | `K6_AUTH_EMAIL` / `K6_AUTH_PASSWORD` — **separate run** |

**Rules:**

- Do **not** have 1 000 VUs password-login unless explicitly testing Supabase Auth.
- Never commit credentials; use CI secrets / local env.
- Session pool: mint cookies offline (Playwright login) → inject via env.

## Pre-load stages (not BL-P0-1)

```bash
# Script validation (health only if no cookie)
k6 run -e BASE_URL=https://<staging> -e STAGE=10 load/k6/app-capacity.js

# Authenticated warm-up
k6 run -e BASE_URL=https://<staging> -e K6_SESSION_COOKIE='...' -e STAGE=10 load/k6/app-capacity.js
k6 run -e BASE_URL=https://<staging> -e K6_SESSION_COOKIE='...' -e STAGE=25 load/k6/app-capacity.js
k6 run -e BASE_URL=https://<staging> -e K6_SESSION_COOKIE='...' -e STAGE=50 load/k6/app-capacity.js
```

Pass criteria for pre-load: error rate < 5%, p95 < 3s, no mass 5xx/429 storms.

**BL-P0-1 remains OPEN** until Phase 7 1 000-VU evidence.
