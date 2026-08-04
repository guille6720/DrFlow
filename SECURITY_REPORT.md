# DrFlow Security Report

**Date:** 2026-08-04  
**Scope:** Authentication, authorization, RLS, JWT/session, roles, permissions, organization (clinic) isolation, ownership, storage, uploads, server actions, API routes  
**Tenant key:** DrFlow uses `clinic_id` as the organization boundary (no separate `organization_id` column)

---

## Executive summary

| Area | Status | Notes |
|------|--------|-------|
| Authentication (JWT / session) | **Pass** | Supabase SSR cookies; server uses `getUser()` not `getSession()` |
| Row Level Security (43 tables) | **Pass** | All application tables have RLS enabled |
| Clinic isolation (DB) | **Mostly pass** | Policies scope by `clinic_id`; reference tables are global by design |
| App-layer permissions | **Mostly pass** | ~37 action files; canonical `requireClinicPermission` pattern |
| Storage isolation | **Partial** | Single private bucket; path-prefix tenancy; role/policy mismatches |
| Defense in depth | **Good** | RLS + app guards + route RBAC; optional integration tests |

**Critical findings (P0):** 3  
**High (P1):** 5  
**Medium (P2):** 8  
**Low (P3):** 4  

Overall posture: **production-viable with known gaps**. Database RLS is the primary backstop; most gaps are app-layer permission omissions or storage policy misalignment, not missing tenant columns.

---

## Methodology

1. Static review of all 52 Supabase migrations (`supabase/migrations/`)
2. Audit of `src/lib/auth/`, `src/lib/permissions/`, `src/lib/actions/` (37 files)
3. Audit of 9 API routes under `src/app/api/`
4. Storage path conventions, bucket policies, job worker (service role)
5. Cross-reference with `src/lib/security/rls-manifest.ts`, `tests/cross-tenant-rls.integration.test.ts`, `tests/permissions.test.ts`
6. Validation against requirement: *every query must verify organization_id* → enforced as `clinic_id` at DB RLS and app layer

---

## 1. Authentication & JWT

### Model

DrFlow does **not** parse JWTs manually. Auth is delegated to **Supabase Auth** via `@supabase/ssr`:

| Layer | File | Behavior |
|-------|------|----------|
| Middleware | `src/middleware.ts` → `src/lib/supabase/middleware.ts` | Cookie presence + `getUser()` (1200ms timeout); redirect to `/login` |
| Server session | `src/lib/auth/session.ts` | `getSession()` wraps `supabase.auth.getUser()` |
| Server client | `src/lib/supabase/server.ts` | Cookie-bound Supabase client (user JWT) |
| Admin client | `src/lib/supabase/admin.ts` | Service role — bypasses RLS; gated at call sites |

### JWT storage

- Tokens live in **httpOnly cookies** (`*-auth-token` pattern)
- Middleware checks cookie before calling Supabase
- Public routes bypass auth: `/`, `/portal/*`, `/solicitar-turno/*`, `/auth/*`, `/api/health`, `/api/version`, static assets

### Active clinic (tenant context)

- Cookie: `drflow_clinic_id` (httpOnly, set by `setActiveClinic`)
- `getActiveClinicId()` validates cookie against user's `clinic_members` rows; falls back to first clinic
- Superadmin: `profiles.is_superadmin` → access to all clinics

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| AUTH-1 | P3 | Middleware does not enforce role/clinic — only login gate (by design; layout + RLS compensate) |
| AUTH-2 | P2 | `/api/jobs/process` and `/api/observability/purge` allow unauthenticated access if `CRON_SECRET` is unset |

---

## 2. Roles & permissions

### Roles

`superadmin` · `clinic_admin` · `doctor` · `secretary` · `patient`

Defined in `src/lib/permissions/roles.ts` with `PERMISSIONS` map and `hasPermission()`.

### Permission matrix (abbreviated)

| Permission | Roles |
|------------|-------|
| `manageClinic`, `manageStaff`, `manageSettings` | superadmin, clinic_admin |
| `viewClinicalRecords`, `editClinicalRecords`, `issuePrescriptions`, `viewPharmacology` | superadmin, clinic_admin, doctor |
| `managePatients`, `manageAppointments`, `manageCashRegister`, `manageWaitingRoom` | superadmin, clinic_admin, secretary, doctor |
| `manageAdminDocuments`, `viewReports`, `managePayments` | superadmin, clinic_admin, secretary |

**Secretary is explicitly excluded** from clinical record access (`viewClinicalRecords`) since migration `034`.

### Route-level RBAC

`canAccessRoute()` in dashboard layout (`src/app/(dashboard)/layout.tsx`):

- Maps URL prefixes → permissions (`/historias`, `/recetas`, `/caja`, etc.)
- **Default allow** for unlisted routes (`/dashboard`, `/agenda`, `/pacientes`) — any clinic member can view; **mutations** still guarded in server actions

### Canonical action guard

```typescript
// src/lib/actions/clinic-guard.ts
requireClinicPermission(permission) → { clinicId, role, isSuperadmin } | error
```

Standard query pattern after guard:

```typescript
.eq("clinic_id", access.clinicId)
```

---

## 3. Organization isolation (`clinic_id`)

DrFlow multi-tenancy is **clinic-scoped**. Every tenant-owned table includes `clinic_id` except global reference data.

### RLS helper functions

| Function | Purpose |
|----------|---------|
| `is_superadmin()` | Platform admin bypass |
| `user_clinic_ids()` | Active memberships for `auth.uid()` |
| `user_role_in_clinic(uuid)` | Role in specific clinic |
| `can_manage_clinic(uuid)` | admin or secretary |
| `can_view_clinical(uuid)` | admin or doctor (not secretary) |
| `can_write_clinical(uuid)` | clinical write + subscription active (`047`) |
| `can_manage_cash(uuid)` | cash module roles |
| `can_manage_admin_docs(uuid)` | admin docs (includes secretary) |
| `clinical_file_clinic_id(path)` | First path segment = clinic UUID for storage |

All helpers use `SET search_path = public` (hardened in `045`).

### Tables without `clinic_id` (intentional global reference)

- `pathologies`, `drugs`, `pathology_drugs`, `symptoms`, `pathology_symptoms`
- `pami_vademecum`

RLS on these: any authenticated member of **any** clinic with qualifying role can read. Not tenant-isolated by design.

### Clinic isolation validation

| Check | Result |
|-------|--------|
| All 43 app tables have RLS | ✅ |
| Tenant tables filter by `clinic_id` in policies | ✅ |
| App actions filter `.eq("clinic_id", …)` | ✅ (guarded actions) |
| Cross-tenant integration test | ✅ Optional (`DRFLOW_RLS_INTEGRATION=1`) |
| `FORCE ROW LEVEL SECURITY` | ❌ Not enabled (table owner / service role can bypass) |

---

## 4. Row Level Security (RLS) audit

### Summary

| Metric | Value |
|--------|-------|
| Tables with RLS | **43 / 43** |
| Tables without RLS | **0** |
| Storage buckets with policies | **1** (`clinical-files`) |
| SECURITY DEFINER RPCs | 12+ (see §7) |

Manifest maintained in `src/lib/security/rls-manifest.ts`.

### Policy highlights by domain

**Core clinical**

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|----------------------|
| `patients` | member OR own patient user | manage OR doctor OR own patient |
| `patient_clinical_profiles` | `can_view_clinical` | same |
| `clinical_records` | `can_view_clinical` | `can_write_clinical` (subscription gate) |
| `prescription_drafts`, `medical_orders` | `can_view_clinical` | `can_write_clinical` |
| `patient_attachments` | `can_view_clinical` | `can_view_clinical` (045) |

**Operations**

| Table | Policy pattern |
|-------|----------------|
| `appointments` | member read; manage/doctor write |
| `cash_*`, `patient_ledger_entries` | `can_manage_cash(clinic_id)` |
| `patient_admin_documents` | `can_manage_admin_docs(clinic_id)` |

**Platform**

| Table | Notes |
|-------|-------|
| `clinic_plugins`, `clinic_feature_flags` | member read; admin write |
| `clinic_jobs` | member INSERT/SELECT — **no role restriction** |
| `clinic_observability_events` | INSERT allows `clinic_id IS NULL` |

**Audit**

| Table | SELECT | INSERT |
|-------|--------|--------|
| `audit_logs` | superadmin OR admin OR `can_view_clinical` (048) | **`auth.uid() IS NOT NULL` only** — no clinic check |
| `clinical_record_audit` | `can_view_clinical` | same; immutable trigger |

### RLS gaps

| ID | Severity | Table / policy | Issue |
|----|----------|----------------|-------|
| RLS-1 | **P0** | `audit_logs_insert` | Any authenticated user can INSERT with arbitrary `clinic_id` |
| RLS-2 | **P0** | `clinical_record_attachments` | Writes use `can_view_clinical`, not `can_write_clinical` / subscription gate |
| RLS-3 | **P1** | `payments`, `telemedicine_sessions`, `consent_records`, `reminder_logs` | Broad `user_clinic_ids()` — secretary can read |
| RLS-4 | **P1** | `clinic_jobs` INSERT | Any clinic member can enqueue jobs |
| RLS-5 | **P2** | `clinic_observability_events` INSERT | Allows orphan rows (`clinic_id IS NULL`) |
| RLS-6 | P3 | No `FORCE ROW LEVEL SECURITY` | Table owner bypass possible |

Key migration files: `002_rls_policies.sql`, `034_secretaria_caja.sql`, `045_security_hardening.sql`, `047_security_phase10.sql`, `048_audit_phase12.sql`.

---

## 5. Server actions audit

**37 files** under `src/lib/actions/`. ~80 exported functions.

### Fully guarded (permission + `clinic_id`)

✅ Majority of clinical, cash, settings, import, and admin flows:

- `appointments.ts`, `patients.ts`, `clinical-records.ts`
- `prescriptions.ts`, `medical-orders.ts`, `patient-attachments.ts`
- `cash-register.ts`, `admin-documents.ts`, `waiting-room.ts`
- `settings.ts`, `invitations.ts`, `clinical-reset.ts`, import family, etc.

### Partial or missing permission checks

| ID | Severity | File | Function | Gap |
|----|----------|------|----------|-----|
| ACT-1 | **P1** | `clinic-services.ts` | `sendReminder` | `requireActiveClinic()` only — **no role permission**; any member can send |
| ACT-2 | P1 | `pami-setup.ts` | `configurePamiCabecera` | Clinic cookie only; relies on RPC `FORBIDDEN` |
| ACT-3 | P1 | `demo-data.ts` | `seedDemoPatientsForActiveClinic` | Same |
| ACT-4 | P2 | `doctor-profile.ts` | `updateMyDoctorProfile` | Session + clinic only; relies on RPC |
| ACT-5 | P2 | `compliance.ts` | `applyClinicLegalAcceptance(clinicId)` | No session check; accepts arbitrary `clinicId` (internal caller only today) |
| ACT-6 | P2 | `invitations.ts` | `acceptPendingInvitations` | RPC-scoped to user (acceptable) |

### Intentionally public / auth lifecycle

- `public-booking.ts` — slug + document verification via SECURITY DEFINER RPCs
- `auth.ts` — sign-in, sign-up, sign-out
- `account.ts` — self-delete

### Global data (no clinic filter — by design)

- `pharmacology.ts` — reference tables / search RPCs; requires `viewPharmacology`

### Service role usage (bypasses RLS)

| File | Guard |
|------|-------|
| `clinical-reset.ts` | `manageClinic` |
| `clinic-purge.ts` | Called from account delete only |
| `invitations.ts` | `manageStaff` + admin client for email |

---

## 6. API routes audit

| Route | Auth | Permission | `clinic_id` filter |
|-------|------|------------|-------------------|
| `/api/command-palette/patients` | ✅ `getUser` via session | ✅ `managePatients` OR `viewClinicalRecords` | ✅ `.eq("clinic_id", clinicId)` |
| `/api/pharmacology` | ✅ `getUser` | ✅ `viewPharmacology` | N/A (global reference) |
| `/api/jobs/process` | ⚠️ `CRON_SECRET` optional | N/A (worker) | Handler must validate paths |
| `/api/observability/purge` | ⚠️ `CRON_SECRET` optional | Service role RPC | N/A |
| `/api/auth/login`, `signout`, `reset-password` | Public auth flows | N/A | N/A |
| `/api/health`, `/api/version` | Public | N/A | N/A |

---

## 7. Storage & uploads

### Bucket: `clinical-files`

| Property | Value |
|----------|-------|
| Public | **false** |
| Size limit | 10 MB |
| Allowed MIME (bucket config) | `application/pdf` only |
| Path convention | `{clinic_id}/…` |

### Path prefixes

| Use | Pattern |
|-----|---------|
| Clinical PDFs | `{clinicId}/patients/{patientId}/{uuid}-{fileName}` |
| Admin docs | `{clinicId}/{patientId}/admin/{timestamp}-{fileName}` |
| Import staging | `{clinicId}/import-staging/{batchId}/{fileName}` |

### Storage RLS policies

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `clinical_files_select` | SELECT | `can_view_clinical(clinical_file_clinic_id(name))` |
| `clinical_files_insert` | INSERT | `can_view_clinical(...)` |
| `clinical_files_delete` | DELETE | `can_view_clinical(...)` |

No UPDATE policy. No separate policies for admin or staging paths.

### App-layer upload guards

**Clinical attachments** (`patient-attachments.ts`):

- ✅ `requireClinicalAccess(edit/view)`
- ✅ Patient validated: `.eq("clinic_id", access.clinicId)`
- ✅ Signed URLs: 3600s TTL

**Admin documents** (`admin-documents.ts`):

- ✅ `manageAdminDocuments`
- ⚠️ **Missing patient→clinic ownership check** before upload

### Storage findings

| ID | Severity | Issue |
|----|----------|-------|
| STOR-1 | **P0** | Storage INSERT/DELETE use `can_view_clinical`; admin docs app permission is `can_manage_admin_docs` (secretary) — **secretary blocked at storage layer** |
| STOR-2 | **P1** | Job worker (service role) does not validate `payload.storagePath.startsWith(clinic_id/)` — cross-tenant read risk |
| STOR-3 | P1 | Admin upload missing patient belongs to clinic validation |
| STOR-4 | P2 | Bucket MIME = PDF only but code uploads CSV/staging octet-stream |
| STOR-5 | P2 | Purge/reset omit admin docs and staging paths |
| STOR-6 | P2 | Signed URLs are bearer tokens (1h); no user binding |
| STOR-7 | P3 | `clinical_record_attachments` table unused in app — latent surface |

---

## 8. Ownership validation

| Resource | App validates owner clinic | DB RLS |
|--------|--------------------------|--------|
| Patient | ✅ actions filter `clinic_id` | ✅ |
| Appointment | ✅ | ✅ |
| Clinical record | ✅ | ✅ |
| Prescription / order | ✅ | ✅ |
| Patient attachment | ✅ patient lookup | ✅ |
| Admin document | ⚠️ partial | ✅ `can_manage_admin_docs` |
| Storage object | Path prefix only | ✅ `clinical_file_clinic_id` |
| Job payload path | ❌ not validated in worker | N/A (service role) |

Patient portal: `patients.user_id = auth.uid()` allows patient self-read/update on demographics (027).

---

## 9. SECURITY DEFINER RPCs

RPCs bypass RLS. Documented in `rls-manifest.ts`:

| RPC | Tenant scoping |
|-----|----------------|
| `setup_user_clinic` | User-scoped setup |
| `submit_public_booking` | Public slug |
| `get_public_booking_occupancy` | Public slug (045 — replaced anon appointment SELECT) |
| `seed_demo_patients_for_clinic` | Must verify caller clinic membership |
| `seed_pami_cabecera_for_clinic` | Clinic-scoped |
| `claim_clinic_jobs` / `complete_clinic_job` | Worker |
| `purge_old_observability_events` | Cron |
| Pharmacology / PAMI search | Global read |

**Requirement:** each RPC must internally validate `clinic_id` or public token. Periodic review recommended when adding new RPCs.

---

## 10. Compliance matrix (requirements vs implementation)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Every query verifies organization_id | **Mostly ✅** | RLS on all tenant tables; app `.eq("clinic_id")` on guarded actions; loaders receive `clinicId` from authenticated pages |
| Every action validates permissions | **Mostly ✅** | 4–6 actions rely on RPC-only or clinic-only guards (see ACT-*) |
| RLS enabled on all tables | **✅** | 43/43 |
| JWT validated server-side | **✅** | `getUser()` everywhere |
| Storage tenant isolation | **Partial** | Path prefix + RLS; role mismatches |
| Audit immutability | **✅** | Triggers on `audit_logs`, `clinical_record_audit` |
| Cross-tenant test | **Optional** | `tests/cross-tenant-rls.integration.test.ts` |

---

## 11. Remediation roadmap

### P0 — Immediate

1. **Tighten `audit_logs_insert`:** require `clinic_id IN user_clinic_ids()` AND `user_id = auth.uid()`
2. **Align `clinical_record_attachments`** with `can_write_clinical` (match `047` clinical writes)
3. **Fix storage policies** for admin paths: add `can_manage_admin_docs(clinical_file_clinic_id(name))` OR path-prefix policies for `/admin/` and `/import-staging/`

### P1 — Next sprint

4. Add `manageAppointments` (or equivalent) to `sendReminder`
5. Validate `storagePath` prefix in job handlers before service-role download
6. Validate patient→clinic in `admin-documents.ts` uploads
7. Add app-layer permission to `pami-setup.ts` / `demo-data.ts` (`manageSettings` or `manageClinic`)
8. Restrict `clinic_jobs` INSERT to appropriate roles

### P2 — Hardening

9. Require `CRON_SECRET` in production for worker routes
10. Expand bucket MIME types or split buckets (clinical PDF vs staging CSV)
11. Extend purge/reset to admin docs + staging paths
12. Add storage cross-tenant integration tests
13. Narrow `user_clinic_ids()` on PHI-adjacent tables where secretary should not read

### P3 — Hygiene

14. Enable `FORCE ROW LEVEL SECURITY` on clinical tables
15. Remove or wire `clinical_record_attachments` if unused
16. Document RPC auth contracts in migration comments

---

## 12. Test coverage

| Test | Coverage |
|------|----------|
| `tests/permissions.test.ts` | `hasPermission`, `canAccessRoute` |
| `tests/rls-policies.test.ts` | RLS manifest vs migrations |
| `tests/security-phase10.test.ts` | Phase 10 security helpers |
| `tests/lib-security-extended.test.ts` | Extended security utilities |
| `tests/security-headers.test.ts` | HTTP security headers |
| `tests/cross-tenant-rls.integration.test.ts` | Cross-clinic patient read (opt-in) |
| Storage RLS tests | **Missing** |

Run cross-tenant integration:

```bash
DRFLOW_RLS_INTEGRATION=1 npm test -- tests/cross-tenant-rls.integration.test.ts
```

---

## 13. Key file index

| Path | Role |
|------|------|
| `supabase/migrations/002_rls_policies.sql` | Base RLS |
| `supabase/migrations/045_security_hardening.sql` | Storage + attachment hardening |
| `supabase/migrations/047_security_phase10.sql` | Subscription gate, clinical profiles |
| `supabase/migrations/048_audit_phase12.sql` | Audit read + immutability |
| `supabase/migrations/028_clinical_files_storage.sql` | Storage bucket |
| `src/lib/auth/session.ts` | Session, clinic cookie, audit |
| `src/lib/permissions/roles.ts` | RBAC |
| `src/lib/actions/clinic-guard.ts` | Action guards |
| `src/lib/security/rls-manifest.ts` | RLS table manifest |
| `src/lib/supabase/middleware.ts` | Auth middleware |
| `src/lib/actions/patient-attachments.ts` | Clinical upload/download |
| `src/lib/actions/admin-documents.ts` | Admin upload/download |
| `src/lib/jobs/process.ts` | Service-role worker |

---

## 14. Conclusion

DrFlow implements a **defense-in-depth** security model:

1. **Middleware** — authentication only  
2. **Dashboard layout** — route-level RBAC  
3. **Server actions** — permission + `clinic_id` filtering  
4. **Supabase RLS** — tenant isolation at the database  

The system **meets the organization isolation requirement** for all tenant-owned data via `clinic_id`. Gaps are concentrated in audit log INSERT policy, storage role alignment, a handful of under-guarded server actions, and job worker path validation. Addressing the P0/P1 items above would bring the posture to **strong** for a multi-tenant clinical SaaS.

---

## 15. Remediation applied (2026-08-04)

Migration **`053_security_p0_p1_fixes.sql`** and app-layer patches address P0/P1 findings:

| Finding | Fix |
|---------|-----|
| RLS-1 `audit_logs_insert` | Policy requires `user_id = auth.uid()` and `clinic_id IN user_clinic_ids()` |
| RLS-2 `clinical_record_attachments` | Split policies; writes use `can_write_clinical` |
| STOR-1 storage role mismatch | Path-aware `can_read/write_clinical_storage()` — admin/staging/clinical |
| STOR-2 job worker path validation | `assertStoragePathInClinic()` in import job handlers |
| STOR-3 admin upload ownership | Patient validated against `clinic_id` before upload |
| ACT-1 `sendReminder` | Now requires `manageAppointments` |
| ACT-2 `configurePamiCabecera` | Now requires `manageSettings` |
| ACT-3 `seedDemoPatientsForActiveClinic` | Now requires `manageClinic` |
| RLS-4 `clinic_jobs` INSERT | Restricted to admin/doctor/secretary roles |
| AUTH-2 open cron routes | Production requires `CRON_SECRET` |
| STOR-4 bucket MIME | Bucket allows PDF, CSV, octet-stream |

**Remaining (P2/P3):** `FORCE ROW LEVEL SECURITY`, storage integration tests, purge admin/staging paths, narrow `user_clinic_ids()` on PHI-adjacent tables.

Tests: `tests/security-p0-p1-fixes.test.ts`, `tests/tenant-scope.test.ts`

---

*Generated by security audit — 2026-08-04. Updated after P0/P1 remediation.*
