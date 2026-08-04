# Informe de Auditoría RLS — Supabase DrFlow

**Fecha:** 2026-07-30  
**Alcance:** 44 tablas públicas + bucket `clinical-files` (storage.objects)  
**Migraciones revisadas:** `001`–`057` + nueva **`058_rls_audit_hardening.sql`**  
**Helpers RLS:** `is_superadmin`, `user_clinic_ids`, `user_role_in_clinic`, `can_manage_clinic`, `can_view_clinical`, `can_write_clinical`, `is_doctor_in_clinic`, `can_manage_admin_docs`, `can_manage_cash`, `is_clinic_staff` *(058)*

---

## Resumen ejecutivo

| Métrica | Resultado |
|---------|-----------|
| Tablas con RLS habilitado | **44/44** (100%) |
| Políticas `USING (true)` / `WITH CHECK (true)` | **0** |
| Vulnerabilidades HIGH corregidas en 058 | **2** (`clinic_jobs`, `observability INSERT`) |
| Endurecimientos MEDIUM en 058 | **6** tablas |
| Riesgo residual global | **Bajo** |

Todas las tablas del manifiesto (`src/core/security/rls-manifest.ts`) tienen `ENABLE ROW LEVEL SECURITY` y al menos una política activa. No se eliminaron políticas válidas; la migración 058 **reemplaza** solo políticas `FOR ALL` excesivamente amplias.

---

## Modelo de autorización

```
auth.uid() ──► profiles / clinic_members
                    │
                    ├── is_superadmin()          → bypass tenant (SaaS ops)
                    ├── user_clinic_ids()        → membership activa
                    ├── user_role_in_clinic()    → rol en tenant
                    ├── is_clinic_staff()        → admin + doctor + secretary (058)
                    ├── can_manage_clinic()      → admin + secretary
                    ├── can_view_clinical()      → admin + doctor (PHI clínico)
                    ├── can_write_clinical()     → view + trial activo
                    ├── can_manage_cash()        → caja
                    └── can_manage_admin_docs()  → documentos administrativos
```

**Ownership explícito:** `profiles` (`id = auth.uid()`), `patients.user_id`, `audit_logs.user_id = auth.uid()` en INSERT (053), `clinic-purge` vía app + RPC.

**Anon (reserva pública):** políticas acotadas a clínicas con `public_booking_links.is_active`; turnos ocupados vía RPC `get_public_booking_occupancy` (045) — sin SELECT anon directo a `appointments`.

---

## Inventario por tabla

Leyenda de riesgo: 🟢 Bajo · 🟡 Medio · 🔴 Alto · ⚪ Informativo (público intencional)

### Core / identidad

| Tabla | RLS | Políticas efectivas | Riesgo |
|-------|-----|---------------------|--------|
| **clinics** | ✅ | `clinics_select` (member/superadmin), `clinics_insert` (auth), `clinics_update` (clinic_admin), `clinics_select_setup` (onboarding), `clinics_anon_public_select` (booking) | 🟢 |
| **profiles** | ✅ | `profiles_select/update` (`id = auth.uid()`), `profiles_insert` (self) | 🟢 |
| **clinic_members** | ✅ | SELECT members; INSERT admin o bootstrap; UPDATE admin | 🟢 |
| **clinic_invitations** | ✅ | `clinic_invitations_admin` → `can_manage_clinic` | 🟢 |

### Configuración clínica

| Tabla | RLS | Políticas efectivas | Riesgo |
|-------|-----|---------------------|--------|
| **specialties** | ✅ | SELECT tenant; `specialties_manage` → `can_manage_clinic`; anon public select (booking) | 🟢 |
| **locations** | ✅ | Idem specialties | 🟢 |
| **professionals** | ✅ | SELECT tenant; manage → `can_manage_clinic`; anon public select | 🟢 |
| **consultation_reasons** | ✅ | SELECT tenant; manage → `can_manage_clinic`; anon public select | 🟢 |
| **clinical_templates** | ✅ | SELECT tenant; manage → `can_manage_clinic` OR doctor | 🟢 |
| **public_booking_links** | ✅ | ALL → `can_manage_clinic`; anon select active slugs | 🟢 |
| **clinic_plugins** | ✅ | SELECT members; INSERT/UPDATE → `clinic_admin` | 🟢 |
| **clinic_feature_flags** | ✅ | SELECT members; INSERT/UPDATE → `clinic_admin` | 🟢 |

### Pacientes

| Tabla | RLS | Políticas efectivas | Riesgo |
|-------|-----|---------------------|--------|
| **patients** | ✅ | SELECT tenant + `user_id = auth.uid()`; INSERT admin/secretary/doctor/patient; UPDATE admin/doctor/owner | 🟢 |
| **patient_clinical_profiles** | ✅ | CRUD → `can_view_clinical` (PHI aislado de secretaría) | 🟢 |
| **patient_attachments** | ✅ | CRUD → `can_view_clinical` (045) | 🟢 |
| **patient_app_share_log** | ✅ | SELECT/INSERT/UPDATE → **`is_clinic_staff`** *(058)* | 🟢 *(antes 🟡)* |
| **patient_admin_documents** | ✅ | ALL → `can_manage_admin_docs` | 🟢 |

### Agenda

| Tabla | RLS | Políticas efectivas | Riesgo |
|-------|-----|---------------------|--------|
| **availability_rules** | ✅ | SELECT members; writes → **`is_clinic_staff`**; delete admin/secretary *(058)*; anon select | 🟢 *(antes 🟡)* |
| **schedule_blocks** | ✅ | Idem availability_rules *(058)* | 🟢 *(antes 🟡)* |
| **appointments** | ✅ | SELECT staff + patient owner; INSERT/UPDATE admin/doctor; anon select removido (045) | 🟢 |

### Clínico

| Tabla | RLS | Políticas efectivas | Riesgo |
|-------|-----|---------------------|--------|
| **clinical_records** | ✅ | SELECT `can_view_clinical`; INSERT/UPDATE doctor/admin + trial (047) | 🟢 |
| **clinical_record_attachments** | ✅ | SELECT view; writes `can_write_clinical` (053) | 🟢 |
| **clinical_record_audit** | ✅ | SELECT/INSERT `can_view_clinical`; triggers inmutabilidad (048/055) | 🟢 |
| **prescription_drafts** | ✅ | SELECT view; writes `can_write_clinical` (047) | 🟢 |
| **medical_orders** | ✅ | SELECT view; writes `can_write_clinical` (047) | 🟢 |

### Operaciones / facturación

| Tabla | RLS | Políticas efectivas | Riesgo |
|-------|-----|---------------------|--------|
| **reminder_logs** | ✅ | Staff CRUD; delete admin *(058)* | 🟢 *(antes 🟡)* |
| **telemedicine_sessions** | ✅ | SELECT clinical/manage; writes admin/doctor *(058)* | 🟢 *(antes 🟡)* |
| **payments** | ✅ | CRUD → **`can_manage_clinic`**; delete admin *(058)* | 🟢 *(antes 🟡)* |
| **consent_records** | ✅ | SELECT clinical/admin; writes solo RPC `record_patient_data_consent` *(058)* | 🟢 *(antes 🟡)* |
| **cash_charge_types** | ✅ | SELECT global + tenant | 🟢 |
| **cash_payment_methods** | ✅ | SELECT global + tenant | 🟢 |
| **cash_charges** | ✅ | ALL → `can_manage_cash` | 🟢 |
| **patient_ledger_entries** | ✅ | ALL → `can_manage_cash` | 🟢 |
| **cash_invoices** | ✅ | ALL → `can_manage_cash` | 🟢 |
| **cash_daily_closures** | ✅ | ALL → `can_manage_cash` | 🟢 |

### Plataforma / jobs / auditoría

| Tabla | RLS | Políticas efectivas | Riesgo |
|-------|-----|---------------------|--------|
| **audit_logs** | ✅ | SELECT admin + clinical (048); INSERT tenant + `user_id = auth.uid()` (053); inmutable (055) | 🟢 |
| **clinic_jobs** | ✅ | SELECT/INSERT staff roles *(053/058)*; UPDATE vía RPC SECURITY DEFINER | 🟢 *(antes 🔴 SELECT)* |
| **clinic_observability_events** | ✅ | SELECT **`clinic_admin`**; INSERT staff + tenant *(058)* | 🟢 *(antes 🟡)* |

### Referencia / farmacología

| Tabla | RLS | Políticas efectivas | Riesgo |
|-------|-----|---------------------|--------|
| **pathologies** | ✅ | SELECT clinical staff (005) | 🟢 |
| **drugs** | ✅ | SELECT clinical staff | 🟢 |
| **pathology_drugs** | ✅ | SELECT clinical staff | 🟢 |
| **symptoms** | ✅ | SELECT clinical staff (011) | 🟢 |
| **pathology_symptoms** | ✅ | SELECT clinical staff | 🟢 |
| **pami_vademecum** | ✅ | SELECT admin/doctor/secretary (042) | 🟢 |

### Storage (`clinical-files`)

| Recurso | Políticas | Riesgo |
|---------|-----------|--------|
| **storage.objects** | SELECT/INSERT/DELETE path-aware `can_read/write_clinical_storage` (053) | 🟢 |

---

## Hallazgos corregidos en 058

| Tabla | Problema | Corrección |
|-------|----------|------------|
| `clinic_jobs` | SELECT abierto a cualquier miembro (incl. `patient`); payloads sensibles | SELECT limitado a staff |
| `clinic_observability_events` | INSERT con `clinic_id IS NULL` para cualquier auth | INSERT requiere tenant + staff; null solo superadmin |
| `clinic_observability_events` | SELECT para cualquier miembro | SELECT solo `clinic_admin` |
| `telemedicine_sessions` | `FOR ALL` con `user_clinic_ids` | Políticas split clinical/manage + doctor writes |
| `payments` | `FOR ALL` incluía médicos | Alineado con `can_manage_clinic` |
| `consent_records` | `FOR ALL` — secretaría podía escribir | Solo SELECT; writes vía RPC |
| `reminder_logs` | `FOR ALL` genérico | Staff + delete admin |
| `patient_app_share_log` | Membership genérica | `is_clinic_staff` |
| `availability_rules` / `schedule_blocks` | `FOR ALL` — patient role podía mutar | Writes staff; delete admin/secretary |

---

## Políticas anon (reserva online) — revisadas OK

| Política | Tabla | Alcance |
|----------|-------|---------|
| `public_booking_links_anon_select` | public_booking_links | Solo `is_active` |
| `clinics_anon_public_select` | clinics | Clínicas con booking activo |
| `professionals_anon_public_select` | professionals | Profesionales de esas clínicas |
| `*_anon_public_select` | specialties, locations, rules, reasons, blocks | Datos mínimos booking |
| ~~`appointments_anon_availability_select`~~ | — | **Eliminada** (045) → RPC `get_public_booking_occupancy` |

---

## RPC SECURITY DEFINER — revisadas

Todas documentadas en `rls-manifest.ts` acotan por `auth.uid()`, `p_clinic_id`, slug público o rol. Worker jobs (`claim_clinic_jobs`, `complete_clinic_job`) revocadas de PUBLIC.

---

## Pruebas realizadas

| Prueba | Resultado |
|--------|-----------|
| `tests/rls-policies.test.ts` | ✅ Manifest 44 tablas |
| `tests/rls-audit-hardening.test.ts` | ✅ 7 tests migración 058 |
| `tests/security-p0-p1-fixes.test.ts` | ✅ Storage + audit INSERT |
| `npm run test:rls:static` | ✅ (via quality gate) |

---

## Recomendaciones futuras

1. **RLS en `consent_records` INSERT:** añadir política deny explícita o trigger si se requiere defensa extra más allá de ausencia de policy.
2. **`cash_charge_types` / `cash_payment_methods`:** evaluar políticas INSERT/UPDATE para `clinic_admin` si el catálogo pasa a ser editable desde app.
3. **Test de integración Supabase local** con fixtures por rol (patient, secretary, doctor) — complemento al audit estático.
4. **Aplicar 058 en producción** junto con migración 057 pendiente.

---

## Archivos generados / modificados

- `supabase/migrations/058_rls_audit_hardening.sql` *(nuevo)*
- `tests/rls-audit-hardening.test.ts` *(nuevo)*
- `RLS_AUDIT_REPORT.md` *(este informe)*
