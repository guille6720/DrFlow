# Ownership audit — Server Actions & API Routes

Auditoría de operaciones mutantes (jul 2026). Objetivo: además del control por rol, garantizar **ownership** — que el recurso pertenezca a la clínica activa y que no sea posible modificar datos cambiando únicamente un ID en el payload.

## Modelo de defensa

| Capa | Mecanismo |
|------|-----------|
| **App** | `src/core/security/ownership-guard.ts` — validación explícita de FKs antes de insert/update/RPC |
| **DB** | RLS por `clinic_id` + trigger `enforce_patient_clinic_consistency` (067: rechaza drift) |
| **RPC** | `assert_fk_in_clinic` / `assert_appointment_patient_match` en funciones `SECURITY DEFINER` (067) |

## Gaps corregidos (P1–P3)

| Operación | Archivo | Validación añadida |
|-----------|---------|-------------------|
| `createClinicalRecord` | `features/historias/actions/clinical-records.ts` | patient, professional, appointment ∈ clínica; turno ↔ paciente |
| `updateClinicalRecord` | idem | idem |
| `createCashCharge` | `lib/actions/cash-register.ts` | patient, professional?, appointment? |
| `addLedgerEntry` | idem | patient, professional? |
| `createAppointment` | `lib/actions/appointments.ts` | patient, professional, location?, specialty? |
| `updateAppointment` | idem | idem (FKs del body) |
| `savePrescriptionDraft` | `features/recetas/actions/prescriptions.ts` | patient, professional, clinical_record? |
| `createMedicalOrder` | `features/recetas/actions/medical-orders.ts` | idem |
| `createMockPayment` | `lib/actions/clinic-services.ts` | patient, appointment? + match paciente |
| `enqueuePatientAiSummaryJob` | `lib/actions/import-jobs.ts` | patient ∈ clínica |
| `createProfessional` | `lib/actions/settings.ts` | specialty? ∈ clínica |
| `createScheduleBlock` | idem | professional ∈ clínica |
| `createAvailabilityRule` | idem | professional ∈ clínica |

## Operaciones ya seguras (muestra)

Operaciones que **ya** filtraban por `clinic_id` en el recurso destino (update/delete por ID) o no recibían FKs cross-tenant:

- `voidCashCharge`, `voidPrescription`, `voidMedicalOrder` — RPC/action con `.eq("clinic_id", clinicId)`
- `updateAppointmentStatus`, `startConsultationFromAppointment`, `finalizeConsultation` — turno cargado con filtro de clínica
- CRUD de pacientes, adjuntos, documentos admin — repositorios con `clinic_id`
- Updates de configuración por ID con filtro de clínica
- API routes de auth, cron, observability — sin escritura cross-tenant o con secret de servicio

## API Routes mutantes

| Ruta | Escritura | Ownership |
|------|-----------|-----------|
| `POST /api/auth/*` | sesión/usuario | N/A (auth global) |
| `POST /api/cron/*` | jobs | service role + filtro job/clinic |
| `POST /api/observability/events` | telemetría | clinicId desde sesión |
| `POST /api/clinical-ai`, `admin-ops-ai` | sin DB directa | N/A |

## Tampering cross-clinic

Escenario bloqueado:

1. Usuario autenticado en clínica A con permiso válido.
2. Envía `patient_id` (u otro FK) de clínica B en el formulario/RPC.
3. **Antes:** RLS/trigger podían fallar silenciosamente o reescribir `clinic_id` (060).
4. **Ahora:** la action devuelve error claro; RPC/trigger rechazan con excepción.

## Migración

`supabase/migrations/067_ownership_hardening.sql`:

- Trigger `enforce_patient_clinic_consistency` pasa de reescribir a **RAISE EXCEPTION**.
- Helpers `assert_fk_in_clinic`, `assert_appointment_patient_match`.
- RPCs: `create/update_clinical_record_atomic`, `create_cash_charge_atomic`, `add_patient_ledger_entry_atomic`.

## Tests

- `tests/ownership-guard.test.ts` — unit tests del guard de aplicación.
- `tests/ownership-hardening-migration.test.ts` — contrato SQL 067.

## Uso para nuevas actions

```typescript
import { verifyClinicalRecordForeignKeys } from "@/core/security/ownership-guard";

const ownership = await verifyClinicalRecordForeignKeys(supabase, clinicId, {
  patientId: parsed.data.patient_id,
  professionalId: parsed.data.professional_id,
  appointmentId: parsed.data.appointment_id,
});
if (!ownership.ok) return { error: ownership.error };
```

Para updates por ID: siempre combinar `.eq("id", id).eq("clinic_id", clinicId)` o usar `requireResourceInClinic` de `tenant-scope.ts`.
