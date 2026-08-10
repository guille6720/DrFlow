# RLS + Performance Audit — PROMPT 09

**Date:** 2026-08-10  
**Migration:** `090_rls_performance_hardening.sql`

## Objective

Strict multiclinic isolation without unnecessary full-table scans or duplicated membership lookups in policy evaluation.

## Authorization model (unchanged)

```
auth.uid()
  ├── is_superadmin()           → bypass (audited)
  ├── user_clinic_ids()         → tenant membership (SECURITY DEFINER)
  ├── user_role_in_clinic()     → per-clinic role lookup
  ├── is_clinic_staff()         → admin | doctor | secretary
  ├── can_manage_clinic()       → admin | secretary
  ├── can_view_clinical()       → admin | doctor (+ trial gate on writes)
  └── can_write_clinical()      → view + subscription active
```

RLS remains **enabled on all clinic-scoped tables** — no disable-as-fix.

## Findings

| Issue | Risk | Fix in 090 |
|-------|------|------------|
| Inline `clinic_members` subquery in 084 SELECT policies | Perf: invoker scan + duplicate logic vs `user_clinic_ids()` | Replace with `user_clinic_ids()` |
| `can_manage_clinic OR is_doctor_in_clinic` on writes | Perf: 4+ helper calls per row | Equivalent `is_clinic_staff(clinic_id)` |
| `clinic_jobs_select` double membership check | Perf: redundant `user_clinic_ids()` + `user_role_in_clinic` | `is_clinic_staff(clinic_id)` |
| No composite index on `clinic_members(user_id, is_active)` | Perf: hot path for all helpers | `idx_clinic_members_user_active_clinic` |
| No index on `patients(user_id)` | Perf: portal appointment policy subquery | `idx_patients_user_id` |
| 11 tables missing from `rls-manifest.ts` | CI gap | Manifest updated (068–084) |

## Not changed (security preserved)

- **Notification queue SELECT/UPDATE** — still `can_manage_clinic` only (doctors cannot read/manage worker queue).
- **PHI policies** (`can_view_clinical`, `can_write_clinical`) — unchanged.
- **PAMI nested EXISTS** (079) — documented follow-up; denormalizing `clinic_id` on child rows needs schema review.
- **Storage path policies** (053) — already use dedicated helpers.

## Security test matrix

| Actor | Expected | Verification |
|-------|----------|--------------|
| User clínica A | No read/write clínica B rows | Static policies + optional `DRFLOW_RLS_INTEGRATION=1` |
| Superadmin | Cross-clinic when authorized | `is_superadmin()` in policies |
| Doctor / secretary / admin | Staff scope via `is_clinic_staff` / role helpers | 090 equivalence tests |
| Patient portal | Own `patients.user_id` rows only | `appointments_select` + `idx_patients_user_id` |

### Run integration checks (optional)

```bash
DRFLOW_RLS_INTEGRATION=1 npm test -- tests/cross-tenant-rls.integration.test.ts
```

Requires real Supabase project credentials in `.env.local`.

## Performance measurement

After applying migration 090 on Supabase:

1. Compare `EXPLAIN (ANALYZE)` on `SELECT * FROM waiting_list LIMIT 50` as authenticated staff user before/after.
2. Monitor index usage on `idx_clinic_members_user_active_clinic` for `user_clinic_ids()`.
3. Portal appointment reads should use `idx_patients_user_id`.

## Files

- `supabase/migrations/090_rls_performance_hardening.sql`
- `tests/rls-performance-hardening.test.ts`
- `src/core/security/rls-manifest.ts` (11 tables added)
