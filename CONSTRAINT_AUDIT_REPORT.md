# DrFlow — Auditoría de Restricciones PostgreSQL

**Fecha:** 2026-08-04  
**Migración:** `supabase/migrations/062_constraint_hardening.sql`  
**Principio:** Endurecer integridad sin cambiar flujos de negocio — reparar legacy NULLs, no DELETE.

---

## Resumen

| Tipo | Acciones en 062 | Tablas afectadas |
|------|-----------------|------------------|
| **Data repair** | Backfill timestamps, display names, depósitos | professionals, appointments, consent_records, prescription_drafts, payments, reminder_logs, specialties, consultation_reasons |
| **NOT NULL** | 2 columnas | professionals.display_name, payments.deposit_amount |
| **UNIQUE** | 4 índices | specialties, consultation_reasons, prescription_drafts, telemedicine_sessions |
| **CHECK** | 12 restricciones | prescription_drafts, appointments, consent_records, telemedicine, payments, clinic_jobs, patient_attachments, reminder_logs, cash_charges* |
| **DEFAULT** | 3 columnas | payments.deposit_amount, consent_records.granted, patient_attachments.category |

\* `cash_charges` solo si migración 034 aplicada.

---

## Intencionalmente NO restringido

| Área | Motivo |
|------|--------|
| `patients.medical_history/allergies/notes` | PHI migrada a `patient_clinical_profiles` (047); dual-read activo |
| `patient_clinical_profiles.notes` | Contiene JSON embebido `DRFLOW_CHART_JSON:` |
| `patients.phone/email/birth_date` | Opcionales en Zod staff intake |
| `prescription_drafts.diagnosis_*` en draft | Nullable legítimo hasta emitir |
| `cash_charges.charge_type_id` | App usa enums; FKs catalog reservados |
| Email format CHECK | Validación en app (Zod); i18n frágil en DB |
| `clinics.slug` regex | Slugs legacy podrían violar patrón estricto |

---

## Detalle por restricción agregada

### NOT NULL

| Columna | Impacto |
|---------|---------|
| `professionals.display_name` | UI siempre muestra nombre; backfill desde `profiles.full_name` o `'Profesional'` |
| `payments.deposit_amount` | Alineado con Zod; DEFAULT 0, nunca NULL |

### UNIQUE

| Índice | Impacto |
|--------|---------|
| `idx_specialties_clinic_name` | Evita duplicados en config; dedup renombra con sufijo UUID |
| `idx_consultation_reasons_clinic_name` | Idem motivos de consulta |
| `idx_prescription_drafts_number` | Números RX-AR únicos cuando existen |
| `idx_telemedicine_sessions_appointment` | Una sesión por turno (solo si no hay dupes) |

### CHECK

| Constraint | Regla | Alineación app |
|------------|-------|----------------|
| `prescription_drafts_validity_days_check` | 1–365 | `prescriptionDraftSchema` |
| `prescription_drafts_issued_complete_check` | issued/void requiere diagnóstico + timestamp | Flujo emitir receta |
| `appointments_cancelled_timestamp_check` | cancelled → `cancelled_at` | Cancel flows + RPC portal |
| `appointments_cancelled_by_type_state_check` | metadata solo si cancelled | Limpieza orphan metadata |
| `consent_records_granted_timestamp_check` | granted → `granted_at` | `record_patient_data_consent` |
| `telemedicine_sessions_time_order_check` | ended ≥ started | Integridad temporal |
| `payments_deposit_bounds_check` | 0 ≤ deposit ≤ amount | cash-schemas |
| `payments_paid_amount_check` | paid → amount > 0 | Mock payments |
| `clinic_jobs_job_type_check` | 7 tipos | `clinicJobTypeSchema` |
| `patient_attachments_file_size_check` | file_size ≥ 0 | Upload validation |
| `reminder_logs_sent_timestamp_check` | sent/simulated → `sent_at` | Job send-reminder |
| `cash_charges_collected_amount_check` | collected → amount > 0 | `createCashChargeSchema.positive()` |

### DEFAULT

| Columna | Valor | Impacto |
|---------|-------|---------|
| `payments.deposit_amount` | 0 | Inserts sin seña explícita |
| `consent_records.granted` | false | Opt-in explícito |
| `patient_attachments.category` | `'otro'` | Categoría segura por defecto |

---

## Verificación post-deploy

```sql
SELECT * FROM verify_constraint_integrity();
-- Todos violation_count = 0
```

---

## Despliegue

Orden: **062** después de 061 (o 060 si 061 ya en prod).

Idempotente — safe to re-run.
