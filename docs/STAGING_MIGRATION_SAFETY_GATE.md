# Staging safety gate — pending migrations 110–128 (inspected SQL)

Target: DrFlow-Staging `gprmsufvhabntbrytwyi`. Production untouched.

## Dependency

**Can 121–128 safely run without 110–120?** **YES**

121–128 only require `public.clinics` (+ catalog tables they create). No FK/RPC dependency on clinical DX/TX catalogs, import sessions, or `clinic_jobs` check from 110–120.

## Why staging is behind on 110–120

Clinical DX/TX / import-export product migrations were committed in the repo after the last successful staging `db push` (~through 109). They were never applied to staging. Entitlements 121–128 are also pending. Bundling is **not** required.

## Matrix (summary)

| Migration | Scope | Risk | Entitlements? | Safe for staging alone? |
|-----------|-------|------|---------------|-------------------------|
| 110 | Clinical structured dx/tx columns + recreate atomic RPCs | **High** (DROP FUNCTION signatures, ALTER clinical_records, SECURITY DEFINER) | No | Separate product review |
| 111 | Child dx/tx tables + problem list + RLS | **High** (new tables, RLS, indexes) | No | Needs 110 columns |
| 112–113 | Diagnosis/treatment catalogs + sync RPCs (DELETE children in sync) | **High** | No | Clinical product |
| 114–115 | Favorites / recent usage | Medium | No | Additive |
| 116, 119 | patient_attachments FK/columns | Medium | No | Additive |
| 117 | Seed treatments | Low | No | Seed only |
| 118 | Import/export sessions | Medium | No | Additive |
| 120 | clinic_jobs job_type check widen | Low–Med | No | Constraint replace |
| 121 | Commercial catalog + legacy backfill + trial trigger | Medium | **Yes** | Yes (after dry-run) |
| 122–128 | Superadmin/usage/status/trial RPCs | Low–Med | **Yes** | Yes (after 121) |

Full operator notes: `docs/SUPABASE_ENV_SAFETY.md`, `docs/COMMERCIAL_ENTITLEMENTS.md`.
