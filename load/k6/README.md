# Phase 7 k6 load suite

## Safety

- **Staging / preview only.** Scripts abort if `BASE_URL` looks like production (`drflow.opusorg.com` without staging/preview).
- Require `K6_SESSION_COOKIE` for application capacity.
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
| `lib/*` | metrics, auth, scenarios |

## Env

```
BASE_URL=
K6_SESSION_COOKIE=
K6_PATIENT_ID=          # optional synthetic patient UUID
K6_AUTH_EMAIL=          # auth-capacity only
K6_AUTH_PASSWORD=       # auth-capacity only
UPSTASH_REDIS_REST_URL= # required on target deployment
UPSTASH_REDIS_REST_TOKEN=
```

## Run (after preflight PASS)

```bash
# tools/k6.exe on Windows if not on PATH
./tools/k6.exe run -e BASE_URL=... -e K6_SESSION_COOKIE=... -e STAGE=10 load/k6/app-capacity.js --summary-export=coverage/load/10vu.json
```

Never commit cookies or Redis tokens.
