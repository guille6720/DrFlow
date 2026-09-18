# Disaster Recovery — DrFlow

Runbook for application/database incidents, rollback, and recovery.

**Reference stack:** Vercel + Supabase Postgres  
**Related:** [PRODUCTION.md](./PRODUCTION.md) · [RENAPDIS_PHASE3_READINESS.md](./RENAPDIS_PHASE3_READINESS.md) · [compliance/RENAPDIS_DR_DRILL.md](./compliance/RENAPDIS_DR_DRILL.md) · [compliance/RENAPDIS_SLA_SLO.md](./compliance/RENAPDIS_SLA_SLO.md)

---

## Recovery objectives (honest)

| Metric | ReNaPDiS evaluation target | Current documented capability |
|--------|----------------------------|-------------------------------|
| **RTO** | < **2 hours** | App rollback on Vercel typically **minutes**; full DB restore depends on Supabase restore + env cutover (often longer). **Not proven** until a timed drill is recorded. |
| **RPO** | < **30 minutes** | Default managed **daily backups ≈ 24 h RPO**. **Does not meet** the 30-minute target without **PITR / continuous backup** enabled on a supporting Supabase plan. |

> Do **not** claim RPO < 30 min or RTO < 2 h until PITR (or equivalent) is enabled **and** a restore drill measures it.

### PITR status

| Environment | PITR / continuous backup | Evidence |
|-------------|--------------------------|----------|
| Staging (`gprmsufvhabntbrytwyi`) | **External verification required** — confirm in Supabase Dashboard → Database → Backups | Operator must screenshot plan features |
| Production | **Out of scope for Phase 3 staging work** | Do not change in this phase |

If the current plan does **not** include PITR: **BLOCKED_EXTERNAL** — upgrade plan / enable PITR before claiming RPO compliance. Do not invent a custom dump loop and call it RPO-compliant.

### Enabling PITR (when plan supports it)

1. Supabase Dashboard → Project → Database → Backups  
2. Enable **Point in Time Recovery** (wording may vary by plan)  
3. Confirm retention window  
4. Record evidence in DR drill form  
5. Run restore to a **new temporary project** (never overwrite active staging in-place)

---

## Roles and escalation

1. **On-call technical** — health checks, app rollback, internal comms  
2. **DBA / Supabase admin** — restore Postgres, migrations, RLS verification  
3. **Product / clinic** — user communication, maintenance window  

Notification targets must come from env (`OPS_ALERT_WEBHOOK_URL`) — never hardcode personal emails/phones in git.

---

## Scenario A — Vercel deployment failure

- **Detection:** `/api/health/ready` 503/timeout; Vercel deploy failed; uptime workflow red  
- **Owner:** On-call  
- **Immediate:** Identify last Ready deployment → Promote / rollback  
- **Validation:** `/api/health/ready` 200 + smoke login  
- **Expected recovery:** minutes (app-only)

## Scenario B — Supabase database outage

- **Detection:** health `checks.supabase.ok: false`; [status.supabase.com](https://status.supabase.com)  
- **Owner:** DBA  
- **Immediate:** Confirm provider incident vs project pause/billing  
- **Rollback:** N/A until connectivity returns  
- **Validation:** `npm run check:supabase` / ready probe  
- **Communication:** maintenance notice

## Scenario C — Bad database migration

- **Detection:** SQL errors after migrate; RLS/RPC broken  
- **Owner:** DBA + engineering  
- **Immediate:** Stop further deploys; **rollback app** to last compatible build  
- **Restore:** Prefer **forward-fix** migration; PITR restore to **new** project if required  
- **Never:** automatic reverse of destructive migrations  
- **Validation:** migration consistency tests + clinical smoke

## Scenario D — Accidental data deletion

- **Detection:** Missing rows / user report  
- **Owner:** DBA  
- **Immediate:** Freeze writes if ongoing; identify `clinic_id` scope  
- **Restore:** Restore backup/PITR to temporary project → selective reinsert  
- **Validation:** row counts + audit trail  
- **Do not** restore full dump over active staging without isolation

## Scenario E — Storage outage

- **Detection:** Attachment upload/download failures  
- **Owner:** On-call  
- **Immediate:** Confirm Supabase Storage status; disable noncritical uploads in UI messaging  
- **Validation:** upload/download synthetic file in fiscalization clinic

## Scenario F — Credentials compromise

- **Detection:** Unexpected admin activity; leaked key  
- **Owner:** Security on-call  
- **Immediate:** Rotate Supabase keys / Vercel env; revoke sessions; audit `audit_logs`  
- **Validation:** old keys fail; new deploy healthy  
- **Never** commit rotated secrets

## Scenario G — REFEPS / ReNaPDiS / DNSISA outage

- **Detection:** national submit failures; `REFEPS_FORCE_OUTAGE` drills  
- **Owner:** Engineering  
- **Immediate:** Keep **local** clinical workflows; national channel stays **failed/pending** — never mark as nationally submitted  
- **Validation:** UI message + audit; `legalValidity: none`  
- **No fail-open** for national legal validation

---

## Application rollback (Vercel)

1. Deployments → last **Ready** known-good  
2. Promote / rollback  
3. Validate `/api/version` + `/api/health/ready`  
4. Confirm DB schema still compatible (forward-only migrations)

App rollback ≠ DB rollback.

---

## Backup verification drill (isolated)

```text
recovery point → temporary isolated restore project
  → schema validation
  → synthetic critical-data checks
  → app smoke (point env at temp project OR run SQL checks only)
  → destroy temporary environment
```

**Never** overwrite active staging during restore testing.

Manual dump helper (not RPO-compliant alone): `npm run backup:db`

---

## Encryption at rest

Supabase manages disk encryption for hosted Postgres.  
**Evidence status:** `external verification required` (provider docs + project plan confirmation).  
Do not claim “AES-256 compliant” solely because Supabase is used without recorded evidence.

---

## Immutable operational / audit logs

- Clinical/compliance `audit_logs` remain append-oriented (existing Phase security migrations).  
- Observability events must use `sanitizeMonitoringPayload` — no tokens, OTP, passwords, or unnecessary clinical payloads.

---

## Post-incident checklist

- [ ] Root cause documented  
- [ ] Health probes green  
- [ ] Backup / PITR evidence updated  
- [ ] DR drill form completed if exercise  
- [ ] Update this runbook if process changed  

---

*Phase 3 update: ReNaPDiS targets RPO < 30 min / RTO < 2 h documented as targets; daily-backup gap explicit; PITR external verification required.*
