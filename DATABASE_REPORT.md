# DrFlow Database Report

**Date:** 2026-08-04  
**Scope:** PostgreSQL schema (55 migrations → 054), Supabase RLS/RPC/storage, index coverage vs app query patterns, normalization, unused objects, slow-query recommendations  
**Tenant key:** `clinic_id` on all clinical tables

---

## Executive summary

| Area | Status | Action |
|------|--------|--------|
| **Indexes** | Good baseline (001, 045, 046); gaps on list/report paths | **054** adds 10 indexes |
| **Composite indexes** | Patient workspace covered (046); clinic-wide timelines partial | **054** adds `(clinic_id, created_at)` etc. |
| **Foreign keys** | Mostly `ON DELETE CASCADE` on tenant rows | **054** fixes 3 appointment FKs → `SET NULL` |
| **Triggers** | Overlap guard, `updated_at`, audit immutability, auth cleanup | OK; document only |
| **RLS** | 43 tables enabled; helpers in 045/047/053 | See matrix; P2: `FORCE RLS` |
| **RPC** | 20+ SECURITY DEFINER functions; tenant checks present | Manifest in `rls-manifest.ts` |
| **Unused tables** | 1 latent (`clinical_record_attachments`) | Documented; not dropped |
| **Unused columns** | 4 deprecated PHI on `patients` | COMMENT in **054**; app still dual-reads |
| **Normalization** | PHI split (047) good; cash module normalized (034) | Finish app migration off `patients.*` PHI |
| **Slow queries** | No live `pg_stat_statements` in repo | Recommendations + EXPLAIN targets below |

**Migration delivered:** `supabase/migrations/054_database_audit_fixes.sql`

---

## Methodology

1. Full scan of `supabase/migrations/001`–`053` (schema, indexes, FKs, triggers, RLS, RPC)
2. Cross-reference with `src/**/*.ts` `.from("table")` and `.rpc("fn")` usage
3. Map hot paths from `load-*.ts`, `PERFORMANCE_REPORT.md`, and reportes/caja/agenda pages
4. Compare index list vs query filters (`eq`, `in`, `order`, partial `WHERE`)
5. Static tests: `tests/rls-policies.test.ts`, `tests/database-audit-migration.test.ts`

---

## 1. Schema inventory

### 1.1 Tables (43 with RLS)

| Domain | Tables |
|--------|--------|
| Tenant core | `clinics`, `profiles`, `clinic_members`, `clinic_invitations` |
| Scheduling | `specialties`, `locations`, `professionals`, `availability_rules`, `schedule_blocks`, `consultation_reasons`, `appointments`, `public_booking_links` |
| Patients | `patients`, `patient_clinical_profiles`, `patient_attachments`, `patient_admin_documents`, `patient_app_share_log`, `consent_records` |
| Clinical | `clinical_records`, `clinical_record_attachments`, `clinical_record_audit`, `clinical_templates`, `prescription_drafts`, `medical_orders` |
| Reference | `pathologies`, `drugs`, `pathology_drugs`, `symptoms`, `pathology_symptoms`, `pami_vademecum` |
| Ops | `reminder_logs`, `telemedicine_sessions`, `payments`, `audit_logs` |
| Platform | `clinic_plugins`, `clinic_feature_flags`, `clinic_jobs`, `clinic_observability_events` |
| Caja | `cash_charge_types`, `cash_payment_methods`, `cash_charges`, `patient_ledger_entries`, `cash_invoices`, `cash_daily_closures` |

### 1.2 Migration timeline (high level)

| Phase | Migration | Focus |
|-------|-----------|-------|
| Core | 001–002 | Schema + RLS |
| Booking | 004, 010, 016 | Public portal RPC |
| Pharmacology | 005, 011–012 | Reference + GIN search |
| Prescriptions | 013–014 | Argentina e-Rx |
| Security | 045, 047, 053 | Helpers, PHI split, storage |
| Performance | 046 | Patient workspace composites |
| Jobs / observability | 051–052 | Background work |

---

## 2. Indexes

### 2.1 Existing coverage (strengths)

| Index | Table | Serves |
|-------|-------|--------|
| `idx_clinical_records_clinic_patient_created` (046) | `clinical_records` | Workspace timeline, batch counts |
| `idx_patient_attachments_clinic_patient_created` (046) | `patient_attachments` | Attachment lists |
| `idx_prescription_drafts_clinic_patient_status_issued` (046) | `prescription_drafts` | Recetas workspace |
| `idx_medical_orders_clinic_patient_issued` (046) | `medical_orders` | Órdenes workspace |
| `idx_appointments_clinic_patient_status_start` (046) | `appointments` | Patient appointments |
| `idx_appointments_clinic_prof_start` (045) | `appointments` | Agenda day view |
| `idx_appointments_clinic_start` (001) | `appointments` | Clinic calendar |
| `idx_patients_document` (001) | `patients` | DNI lookup |
| `idx_audit_logs_clinic` (001) | `audit_logs` | Clinic audit feed |
| `idx_audit_logs_patient` (048) | `audit_logs` | Patient audit tab |
| GIN on `pathologies`, `symptoms` (005, 011) | reference | Pharmacology RPC |

### 2.2 Gaps addressed in 054

| New index | Query pattern | Loader / page |
|-----------|---------------|---------------|
| `idx_patients_clinic_active_lastname` | `clinic_id + is_active + ORDER BY last_name` | `/pacientes`, command palette |
| `idx_clinical_records_clinic_created` | `clinic_id + ORDER BY created_at DESC` | `/historias`, `/reportes` |
| `idx_patient_attachments_clinic_patient_filename` | HCE CSV lookup by `file_name` | `loadPatientHceSummaryRows` |
| `idx_patient_app_share_log_clinic_patient` | `clinic_id + IN(patient_id)` | `/pacientes`, historia detail |
| `idx_reminder_logs_clinic_created` | Ops dashboard recent reminders | `load-clinical-operations-dashboard` |
| `idx_payments_clinic_status_created` | Monthly paid revenue | `/reportes`, job `generate-report` |
| `idx_public_booking_links_clinic_active` | Anon RLS subqueries `WHERE is_active` | Portal policies |
| `idx_cash_charge_types_clinic` | Catalog by clinic | Caja (future UI) |
| `idx_cash_payment_methods_clinic` | Catalog by clinic | Caja (future UI) |
| `idx_clinical_templates_clinic_active` | Active templates list | `/historias/nueva` |

### 2.3 Redundant / overlapping indexes (no drop in 054)

| Pair | Notes |
|------|-------|
| `idx_clinical_records_clinic` (045) vs `idx_clinical_records_clinic_patient_created` (046) | 045 useful for clinic-only scans; 046 prefix covers patient filter. Keep both. |
| `idx_clinical_records_patient` (001) vs 046 composite | 001 smaller; 046 supersedes for tenant-scoped patient queries. Low cost to retain. |
| `idx_patient_attachments_patient` (045) vs 046 composite | Same rationale. |
| `idx_medical_orders_clinic` / `_patient` (015) vs 046 | 046 adds `issued_at`; older indexes still used by clinic-wide order lists. |

**Future (P3):** `pg_trgm` GIN on `patients(first_name, last_name, document_number)` for ILIKE search — current token `.or()` filters cannot use B-tree efficiently at scale.

---

## 3. Foreign keys and cascade

### 3.1 Pattern summary

| Pattern | Usage |
|---------|--------|
| `ON DELETE CASCADE` | `clinic_id` → deleting clinic purges tenant data |
| `ON DELETE CASCADE` | `patient_id` on clinical children |
| `ON DELETE SET NULL` | Optional refs: `professionals.user_id`, `uploaded_by`, etc. |
| `ON DELETE CASCADE` | `telemedicine_sessions.appointment_id` (session dies with turno) |

### 3.2 Issues fixed in 054

| FK | Before | After | Why |
|----|--------|-------|-----|
| `clinical_records.appointment_id` | `NO ACTION` (default) | `ON DELETE SET NULL` | Deleting/cancelling turno blocked if HC linked |
| `reminder_logs.appointment_id` | `NO ACTION` | `ON DELETE SET NULL` | Reminder history preserved |
| `payments.appointment_id` | `NO ACTION` | `ON DELETE SET NULL` | Payment row kept for reporting |

### 3.3 Remaining FK notes (no change)

- `clinical_records.professional_id` → no `ON DELETE` (blocks professional delete if records exist) — intentional retention
- `prescription_drafts.clinical_record_id` → optional link, no cascade — OK
- `appointments.rescheduled_from` → self-ref, no cascade — OK

---

## 4. Triggers

| Trigger | Table | Purpose |
|---------|-------|---------|
| `trg_appointment_overlap` | `appointments` | Prevent double-booking same professional |
| `trg_*_updated` | clinics, profiles, patients, appointments, clinical_records | `updated_at` maintenance |
| `on_auth_user_created` | `auth.users` | Profile bootstrap |
| `set_prescription_number` | `prescription_drafts` | Sequential Rx numbering |
| `audit_logs_immutable` / `clinical_record_audit_immutable` | audit tables | Block UPDATE/DELETE (048) |
| `handle_auth_user_before_delete` | `auth.users` | Nullify FK refs (036) |

All triggers use `SET search_path = public` where redefined in later migrations (045+).

---

## 5. Row Level Security (RLS)

### 5.1 Helper functions (tenant isolation)

| Function | Role |
|----------|------|
| `user_clinic_ids()` | JWT → clinic membership set |
| `user_role_in_clinic(uuid)` | Role in tenant |
| `can_manage_clinic(uuid)` | Admin operations |
| `can_view_clinical(uuid)` | Read PHI / HC |
| `can_write_clinical(uuid)` | Write PHI + subscription gate (047) |
| `can_manage_cash(uuid)` | Caja module |
| `can_manage_admin_docs(uuid)` | Admin document uploads |
| `clinical_storage_path_kind(path)` | Storage path tenant parse (053) |

### 5.2 Policy patterns

| Pattern | Tables |
|---------|--------|
| Staff tenant SELECT | Most clinic-scoped tables via `user_clinic_ids()` or role helpers |
| Clinical write gate | `clinical_records`, `prescription_drafts`, `patient_attachments`, etc. |
| Anon portal read | `public_booking_links`, `availability_rules`, partial `appointments` (004) |
| Immutable audit | INSERT-only on `audit_logs` (053 tightens INSERT to own user + tenant) |
| Reference read | `pathologies`, `drugs`, `pami_vademecum` — global read for authenticated |

### 5.3 RLS manifest

All 43 tables in `src/lib/security/rls-manifest.ts` have `ENABLE ROW LEVEL SECURITY` + policies in migrations (verified by `tests/rls-policies.test.ts`).

### 5.4 Recommendations (not in 054)

| ID | Priority | Item |
|----|----------|------|
| RLS-P2-1 | P2 | `FORCE ROW LEVEL SECURITY` on PHI tables (`patients`, `patient_clinical_profiles`, `clinical_records`) |
| RLS-P2-2 | P2 | Split `public_booking_links_all` into SELECT/INSERT/UPDATE/DELETE (045 style) |
| RLS-P3-1 | P3 | Index-only review of anon subquery policies after `idx_public_booking_links_clinic_active` |

---

## 6. RPC (SECURITY DEFINER)

### 6.1 App-called RPCs

| RPC | Tenant check | Called from |
|-----|--------------|-------------|
| `setup_user_clinic` | New user | `auth.ts` |
| `submit_public_booking` | Slug → clinic | `public-booking.ts` |
| `get_public_booking_occupancy` | Slug | Portal |
| `get_patient_appointment_statuses` | Slug + appointment IDs | Portal |
| `cancel_patient_appointment` | Slug + appointment | Portal |
| `record_patient_data_consent` | Slug | Portal |
| `search_pathologies` / `search_symptoms` / `search_pathologies_by_symptoms` | Global ref | Pharmacology |
| `search_pami_vademecum` | Global ref | PAMI search |
| `seed_demo_patients_for_clinic` | `p_clinic_id` | Demo |
| `seed_pami_cabecera_for_clinic` | `p_clinic_id` | PAMI setup |
| `claim_clinic_jobs` / `complete_clinic_job` | Worker | Jobs processor |
| `purge_old_observability_events` | Service cron | API route |
| `update_my_doctor_profile` | `auth.uid()` | Doctor profile |
| `delete_own_account` | `auth.uid()` | Account |
| `accept_clinic_invitations_for_user` | Email match | Invitations |
| `remove_clinic_member_user` | Admin | Invitations |

Manifest: `SECURITY_DEFINER_RPC_CHECKS` in `rls-manifest.ts`.

### 6.2 RPC hygiene

- Booking RPCs validate `slug` + `is_active` on `public_booking_links` before writes
- Job RPCs use `FOR UPDATE SKIP LOCKED` (051)
- Pharmacology search uses `SET search_path = public` and limit caps

---

## 7. Unused / latent objects

### 7.1 Unused table

| Table | App `.from()` | Notes |
|-------|---------------|-------|
| **`clinical_record_attachments`** | **None** | App uses `patient_attachments` + storage bucket `clinical-files`. RLS fixed in 053. **054** adds table COMMENT. Do not drop without data audit. |

### 7.2 Tables with RPC-only or secondary access

| Table | Access |
|-------|--------|
| `pami_vademecum` | `search_pami_vademecum` RPC only |
| `pathologies`, `drugs`, `symptoms`, junction tables | Pharmacology RPCs; `pathology_drugs` direct read in one action |
| `cash_charge_types`, `cash_payment_methods` | Seeded per clinic (034); no TS loader yet — catalogs for caja forms |
| `consent_records` | Compliance export only |
| `telemedicine_sessions` | Telemedicina page + `clinic-services` |
| `payments` | Reportes + mock clinic-services |

### 7.3 Deprecated columns (still in schema)

| Column | Status | Canonical location |
|--------|--------|-------------------|
| `patients.medical_history` | NULL after 047 migrate | `patient_clinical_profiles.medical_history` |
| `patients.allergies` | NULL after 047 | `patient_clinical_profiles.allergies` |
| `patients.regular_medication` | NULL after 047 | `patient_clinical_profiles.regular_medication` |
| `patients.notes` | NULL after 047 | `patient_clinical_profiles.notes` |

**App debt:** Some paths still SELECT PHI from `patients` (e.g. `load-historia-detail-page`, `run-ai-task`) instead of `mergePatientClinicalProfile()`. No column drop until all reads migrated.

---

## 8. Normalization

### 8.1 Good patterns

- **PHI isolation (047):** Clinical notes/allergies/meds in `patient_clinical_profiles` with stricter RLS than `patients`
- **Audit split:** `audit_logs` (entity-level) vs `clinical_record_audit` (field-level HC changes)
- **Caja (034):** Charge types/methods normalized; ledger entries separate from charges
- **Prescriptions vs orders:** `prescription_drafts` vs `medical_orders` — correct separation
- **Document types:** `patient_attachments` (clinical) vs `patient_admin_documents` (secretary)

### 8.2 Improvement backlog

| Item | Recommendation |
|------|----------------|
| Dual PHI read | Route all loaders through `patient-clinical-profile.ts` helpers |
| `clinical_record_attachments` | Wire to UI or deprecate with migration plan |
| Patient search | Move to RPC with `pg_trgm` or generated `search_vector` column |
| Batch record counts | Optional RPC `batch_patient_record_counts(clinic_id, uuid[])` with `GROUP BY` — app batching (046 index) is sufficient for now |

---

## 9. Slow queries and monitoring

No production `pg_stat_statements` snapshot in repo. Recommended hot paths to EXPLAIN after applying **054**:

### 9.1 High-traffic queries

```sql
-- /historias default list
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, patient_id, created_at FROM clinical_records
WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 25;

-- /pacientes list
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, last_name FROM patients
WHERE clinic_id = $1 AND is_active = true
ORDER BY last_name LIMIT 20;

-- Batch HC counts (app N→1 fix)
EXPLAIN (ANALYZE, BUFFERS)
SELECT patient_id FROM clinical_records
WHERE clinic_id = $1 AND patient_id = ANY($2::uuid[]);

-- HCE summary attachment
EXPLAIN (ANALYZE, BUFFERS)
SELECT file_path FROM patient_attachments
WHERE clinic_id = $1 AND patient_id = $2 AND file_name = 'hce-export-resumen.csv';

-- Public portal slug resolve (RPC internal)
EXPLAIN (ANALYZE, BUFFERS)
SELECT clinic_id FROM public_booking_links
WHERE slug = $1 AND is_active = true;
```

### 9.2 Supabase dashboard checks

1. **Database → Query Performance** — sort by mean time × calls after deploy
2. **Advisors → Performance** — unindexed FKs (should be minimal post-054)
3. **Advisors → Security** — RLS enabled (all tenant tables)

### 9.3 Expected improvements (054)

| Query | Before | After (expected) |
|-------|--------|------------------|
| Historias clinic timeline | Index scan on `idx_clinical_records_clinic` + sort | Index-only scan on `(clinic_id, created_at DESC)` |
| Pacientes sort | Filter `clinic_id` + sort | Partial index scan on active patients |
| HCE lookup | Filter `(patient_id)` + heap filter on filename | Index seek on triple key |
| Reportes payments | Seq scan on small tables / filter | `(clinic_id, status, created_at)` range scan |

---

## 10. Migration 054 summary

**File:** `supabase/migrations/054_database_audit_fixes.sql`

| Change type | Count |
|-------------|-------|
| New indexes | 10 |
| FK cascade fixes | 3 |
| COMMENT (deprecated schema) | 5 |

**Apply:**

```bash
# Supabase CLI
supabase db push

# Or SQL Editor: paste 054 file contents
```

**Rollback note:** Index drops are safe; reverting FK changes requires re-adding constraints without `SET NULL` (only if no orphaned appointment deletes occurred).

---

## 11. Test coverage

| Test file | Validates |
|-----------|-----------|
| `tests/rls-policies.test.ts` | RLS manifest vs migrations |
| `tests/database-audit-migration.test.ts` | 054 indexes, FKs, no destructive drops |
| `tests/security-p0-p1-fixes.test.ts` | 053 policies |
| `tests/performance/batch-patient-record-counts.test.ts` | App-side batch counts |

---

## 12. Priority backlog

| ID | Priority | Action |
|----|----------|--------|
| DB-1 | **Done** | Apply 054 indexes + FK fixes |
| DB-2 | P1 | Migrate remaining PHI reads to `patient_clinical_profiles` |
| DB-3 | P2 | `FORCE RLS` on PHI tables |
| DB-4 | P2 | `pg_trgm` patient search index + optional search RPC |
| DB-5 | P3 | Drop or wire `clinical_record_attachments` |
| DB-6 | P3 | Drop deprecated `patients.*` PHI columns (major migration) |
| DB-7 | P3 | Enable `pg_stat_statements` + weekly slow-query review in Supabase |

---

## Related reports

- [SECURITY_REPORT.md](./SECURITY_REPORT.md) — RLS, storage, JWT
- [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) — loader N+1 fixes, bundle size
- [docs/WORKFLOW_OPTIMIZATION.md](./docs/WORKFLOW_OPTIMIZATION.md) — UX click reduction
