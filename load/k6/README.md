# Phase 7 k6 load suite

## Safety

- **Staging / preview only.** Scripts abort if `BASE_URL` looks like production (`drflow.opusorg.com` without staging/preview).
- Require `K6_SESSION_COOKIE` for application capacity (reads).
- Prefer `K6_SESSION_POOL_FILE` for clinical **write** capacity (Phase 7B).
- Require distributed Redis rate limiting (`UPSTASH_*`) verified by:

```bash
node scripts/phase7-load-preflight.mjs --base-url=https://<preview>
```

Memory fallback is **not** accepted for capacity claims.

## Files

| File | Purpose |
|------|---------|
| `app-capacity.js` | Authenticated app journeys (`STAGE=10..1000`) |
| `auth-capacity.js` | Separate login capacity (low VU) |
| `spike.js` | 100 → 1000 → 100 |
| `soak.js` | Sustained 100–250 VU |
| `clinical-write-capacity.js` | Phase 7B clinical write stages |
| `clinical-write-contention.js` | Small hot-row contention probe |
| `lib/*` | metrics, auth, scenarios, write helpers |

## Phase 7B write load

```bash
node scripts/phase7b-seed-write-fixtures.mjs
node scripts/phase7b-mint-session-pool.mjs   # writes gitignored pool; never prints cookies

./tools/k6.exe run -e BASE_URL=https://<preview> \
  -e K6_SESSION_POOL_FILE=coverage/load/phase7b-session-pool.json \
  -e STAGE=10 \
  -e K6_SUMMARY_PATH=coverage/load/write-10vu.json \
  load/k6/clinical-write-capacity.js
```

Prescription issuance is **excluded** from the write mix.

## Env

```
BASE_URL=
K6_SESSION_COOKIE=          # app capacity
K6_SESSION_POOL_FILE=       # write capacity (preferred)
K6_PATIENT_ID=              # optional synthetic patient UUID
K6_AUTH_EMAIL=              # auth-capacity only
K6_AUTH_PASSWORD=           # auth-capacity only
UPSTASH_REDIS_REST_URL=     # required on target deployment
UPSTASH_REDIS_REST_TOKEN=
```

## Run (after preflight PASS)

```bash
# tools/k6.exe on Windows if not on PATH
./tools/k6.exe run -e BASE_URL=... -e K6_SESSION_COOKIE=... -e STAGE=10 load/k6/app-capacity.js --summary-export=coverage/load/10vu.json
```

Never commit cookies or Redis tokens.
