# ReNaPDiS Phase 3 readiness (staging)

Status: **implemented on staging branch** — not production-deployed; **not homologated**.

Scope: fiscalization environment design, health/availability measurement, backup/DR documentation honesty, monitoring/alerts hooks, synthetic data, operational readiness panel.

Phase 1 + Phase 2 controls remain fully required.

---

## Separation of concerns

| Bucket | Items |
|--------|--------|
| **A. Implemented in code** | Health live/ready (+ optional schema probe); REFEPS forced outage mode; monitoring payload sanitizer; operational readiness panel; fiscalization clinic marker migration 142; synthetic seed SQL; compliance docs; alert threshold registry |
| **B. Configured in staging** | Apply migration 142; run fiscalization seed; optional `FISCALIZATION_PUBLIC_URL`; `OPS_ALERT_WEBHOOK_URL`; optional `REFEPS_FORCE_OUTAGE` for drills |
| **C. External provider configuration required** | Supabase PITR enablement / plan upgrade; Vercel alias for fiscalization; DNS for `fiscalizacion.drflow.opusorg.com`; uptime `STAGING_URL` var; encryption evidence screenshots |
| **D. External Ministry / DNSISA action required** | Official platform/repository IDs; Ministry API credentials; official homologation process |
| **E. Production rollout pending** | No production DB/DNS/Vercel production changes in this phase |

---

## Architecture

```text
production candidate commit
        |
        +---- staging (develop deploy)
        |
        +---- fiscalization (same commit; isolated synthetic clinic)
```

Preferred hostname: `fiscalizacion.drflow.opusorg.com` — **manual DNS** unless safe staging-only credentials exist.

---

## Migrations

- `142_renapdis_phase3_fiscalization_marker.sql` — `clinics.is_fiscalization`

---

## Fiscalization access

Logical personas map to existing roles (no RLS weaken; no hardcoded passwords):

| Persona | Role |
|---------|------|
| fiscalization_admin | clinic_admin |
| fiscalization_prescriber | doctor (+ MFA) |
| fiscalization_readonly | secretary / restricted |

See `supabase/seeds/fiscalization/README.md`.

---

## Health

| Endpoint | Role |
|----------|------|
| `/api/health/live` | Liveness |
| `/api/health/ready` | Readiness (Supabase + memory + optional schema + prod env) |
| `/api/health` | Aggregate public health; `?persist=1` cron-auth |

Public payloads omit secrets / service-role details.

---

## Availability

Target ≥ 99.8% monthly — see `docs/compliance/RENAPDIS_SLA_SLO.md`.  
**Statement:** target configured / measurement ready — **not** historically achieved in this document.

---

## Backup / RPO / RTO

| Item | State |
|------|--------|
| Target RPO < 30 min | Documented target |
| Actual RPO today | ~24 h if only daily backups (GAP) |
| PITR | External verification / enablement required |
| Target RTO < 2 h | Documented target; unproven until timed drill |
| Restore drill | Procedure documented; not fabricated as completed |

---

## Monitoring & alerts

Existing: Sentry (optional), `clinic_observability_events`, GitHub uptime workflow.  
Alerts: `OPS_ALERT_THRESHOLDS` + `OPS_ALERT_WEBHOOK_URL` (no personal contacts in repo).

---

## External outage mode

`REFEPS_FORCE_OUTAGE=1` blocks national submit; local workflows may continue; never label as nationally submitted.

---

## Superadmin panel

`/superadmin/renapdis-readiness` — states: ready / partial / blocked_external / not_configured.  
Never shows “Homologated”.

---

## Staging infrastructure check

| Requirement | Current state | Evidence | Action needed |
|-------------|---------------|----------|---------------|
| Fiscalization env | PARTIAL | Seed + marker migration; hostname pending | DNS + Vercel alias |
| App version parity | PASS (design) | Same develop commit for staging & fiscalization | Point fiscalization deploy to same SHA |
| 99.8% availability measurement | PARTIAL | SLI/SLO + uptime workflow | Accumulate history; set `STAGING_URL` |
| Health endpoint | PASS | `/api/health`, `/live`, `/ready` | None |
| Uptime monitoring | PARTIAL | `.github/workflows/uptime.yml` | Configure vars |
| Backup mechanism | PARTIAL | Managed daily backups | Confirm dashboard |
| PITR | BLOCKED_EXTERNAL | External verification required | Enable on supporting plan |
| Actual RPO | FAIL vs target | ~24 h with daily backups | PITR / continuous backup |
| Target RPO < 30 min | PARTIAL | Documented target | Meet via PITR then prove |
| Tested RTO | FAIL (unproven) | No timed drill recorded | Run DR drill |
| Target RTO < 2 h | PARTIAL | Runbook documented | Prove with drill |
| DR plan | PASS (docs) | `docs/DISASTER_RECOVERY.md` | Keep updated |
| DR drill | PARTIAL | Checklist template only | Execute ≥2/year |
| Encrypted storage evidence | BLOCKED_EXTERNAL | Provider evidence pack needed | Screenshot/docs |
| Immutable logs | PASS (existing) | audit_logs + sanitizer | Continue gates |
| Synthetic test data | PARTIAL | `supabase/seeds/fiscalization/` | Apply on staging |
| Status / readiness panel | PASS | `/superadmin/renapdis-readiness` | Superadmin only |
| Ministry external deps | BLOCKED_EXTERNAL | No official IDs | DNSISA / Ministry |

States: **PASS** / **PARTIAL** / **BLOCKED_EXTERNAL** / **FAIL** — no PASS without evidence.

---

## Remaining blockers (non-exhaustive)

1. DNSISA M1/M2 IDs + M4 mapping  
2. Ministry API credentials / homologation  
3. PITR enabled + measured RPO < 30 min  
4. Timed DR drill measuring RTO < 2 h  
5. Fiscalization DNS + Vercel alias  
6. Monthly availability history ≥ 99.8% evidence  
7. Provider encryption-at-rest evidence pack  
8. Production rollout (explicitly out of scope here)
