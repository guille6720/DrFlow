# Informe de Auditoría — Validación de Entradas

**Fecha:** 2026-08-04  
**Alcance:** 37 Server Actions + 13 API routes + 3 auth routes  
**Estándar:** Zod (`src/core/validations/`) — validación **antes** de `createClient()` / queries Supabase

---

## Resumen ejecutivo

| Métrica | Resultado |
|---------|-----------|
| Puntos de entrada analizados | ~57 handlers + 16 routes |
| Gaps HIGH corregidos | **42+** |
| Gaps MEDIUM corregidos | **18+** |
| Módulos de validación | 13 archivos en `src/core/validations/` |
| Tests de validación | 11 (`tests/input-validation-audit.test.ts`) |
| Quality gate | ✅ 510 tests |

---

## Infraestructura de validación

| Archivo | Contenido |
|---------|-----------|
| `params.ts` | UUID, slug, DNI, enums, `searchQuerySchema`, helpers |
| `schemas.ts` | login, patient, appointment, `updateAppointmentBodySchema` |
| `settings-schemas.ts` | clinic settings, professional, schedule block, coverages |
| `clinical-indicators.ts` | indicadores clínicos numéricos |
| `professional-intake.ts` | ingreso/actualización de profesionales |
| `clinic-jobs.ts` | payload por tipo de job |
| `auth-redirect.ts` | rutas seguras, OTP type, error bounded |
| `medical-order.ts` | órdenes médicas |
| `pharmacology-api.ts` | query API farmacología |
| `admin-documents.ts` | upload documentos admin |
| `public-booking.ts` | portal paciente |
| `cash-schemas.ts` | caja, mock payment |
| `doctor-setup.ts` | setup médico titular |

Patrón canónico:

```typescript
const idParsed = parseEntityId(id, "Recurso");
if (!idParsed.ok) return { error: idParsed.error };
const parsed = someSchema.safeParse(input);
if (!parsed.success) return { error: firstZodIssue(parsed.error) };
// recién después: createClient()
```

---

## 1. Entradas sin validar (detectadas)

### HIGH — IDs / payloads directos a DB

| Módulo | Handler | Problema |
|--------|---------|----------|
| appointments | `updateAppointment`, status, consulta | UUID sin validar |
| waiting-room | `updateWaitingRoomStatus` | appointmentId |
| clinic-services | reminders, telemedicine, mock payment | IDs + channel |
| invitations | revoke, role, deactivate, remove | member IDs |
| compliance | legal acceptance, ARCO export | clinic/patient ID |
| settings | delete specialty/location, deactivate patient | entity ID |
| settings | `createProfessional`, `createScheduleBlock` | UUIDs sin validar |
| professional-intake | update/save schedule | professionalId sin UUID |
| patient-chart-indicators | `savePatientClinicalIndicators` | patientId + input sin Zod |
| load-patient-audit-trail | `loadPatientAuditTrail` | patientId sin UUID |
| clinic-jobs | `enqueueClinicJobAction` | payload JSON arbitrario |
| patients / recetas / historias | update, void, attachments | entity IDs |
| public-booking | cancel, slots, statuses | slug, DNI, IDs |
| pharmacology | RPC args, pathology ID | arrays/UUIDs |

### HIGH — Auth open redirect

| Route | Problema |
|-------|----------|
| `/auth/confirm` | `next=//evil.com` permitía redirect externo |
| `/auth/callback` | mismo vector + `error_description` unbounded |

### MEDIUM — strings sin límite / orden incorrecto

| Módulo | Problema |
|--------|----------|
| settings | `updateClinicSettings`, create specialty/location/reason |
| coverages | `updateClinicCoverages` |
| professional-intake | FormData manual, email sin Zod |
| pharmacology actions | `searchPathologies/Symptoms/Pami` sin max length |
| patients | `insurance_plan` bypass del schema |
| appointments | `updateAppointment` validaba body después de DB fetch |
| medical-orders | `createMedicalOrder` validaba en service post-client |
| API command-palette | `q` con sanitización ad-hoc |
| API jobs/process | `limit` podía ser NaN |
| portal manifest | `slug` sin `bookingSlugSchema` |

### LOW — residual aceptable

| Item | Estado |
|------|--------|
| Import FormData (PDF/CSV/JSONL) | size/type OK; JSONL filas sin schema por fila |
| clinical-ai API | `z.record(z.unknown())` en context — bounded parcial |
| clinic-plugins / feature-flags | registry throw vs Zod enum |

---

## 2. Validaciones agregadas

### Server Actions

| Área | Cambio |
|------|--------|
| **IDs globales** | `parseEntityId()` en 35+ handlers |
| **Settings** | `clinicSettingsSchema`, `createProfessionalSchema`, `createScheduleBlockSchema`, `namedEntitySchema`, `createLocationSchema` |
| **Coverages** | `clinicCoveragesSchema` |
| **Professional intake** | `professionalIntakeFormSchema` + UUID en update/schedule |
| **Clinical indicators** | `clinicalIndicatorsSchema` con bounds numéricos |
| **Audit trail** | UUID antes de queries dinámicas |
| **Clinic jobs** | `validateClinicJobEnqueue()` — schema por job type |
| **Appointments** | `updateAppointmentBodySchema` antes de DB |
| **Medical orders** | Zod en action antes de `createClient()` |
| **Patients** | `insurance_plan` en `patientSchema` / `patientAdminSchema` |
| **Pharmacology** | `searchQuerySchema` en 3 búsquedas |
| **deactivatePatient** | fix: usa `idParsed.data` en update/audit |

### API / Auth Routes

| Route | Cambio |
|-------|--------|
| `/auth/confirm` | `safeRedirectPathSchema`, `otpTypeSchema` |
| `/auth/callback` | `parseSafeRedirectPath`, `boundedErrorDescriptionSchema` |
| `/api/command-palette/patients` | `searchQuerySchema` |
| `/api/jobs/process` | `jobLimitSchema` (1–50, no NaN) |
| `/portal/[slug]/manifest` | `bookingSlugSchema` antes de DB |
| `/api/auth/login`, reset | `loginSchema`, `resetEmailSchema` (previo) |
| `/api/pharmacology` | `pharmacologyApiQuerySchema` (previo) |
| `/api/clinical-ai`, admin-ops | max length message (previo) |

---

## 3. Vectores de ataque eliminados / reducidos

| Vector | Mitigación |
|--------|------------|
| **Open redirect** (`next=//host`) | `safeRedirectPathSchema` rechaza `//` y `\` |
| **IDOR probe con UUID malformado** | Rechazo local — menos filtración por errores DB |
| **Job queue injection** | Payload tipado por job — no más JSON arbitrario en `clinic_jobs` |
| **Enum/status injection** en turnos | `appointmentStatusSchema` |
| **RPC arrays arbitrarios** | `entityIdArraySchema.max(50)` |
| **Slug/DNI injection** portal | regex + DNI acotado |
| **DoS strings enormes** | search max 100, settings max 120–2000, AI 8k–50k |
| **NaN en worker limit** | `z.coerce.number().int().min(1).max(50)` |
| **Indicadores clínicos inválidos** | weight 0–500, creatinine 0–50, risk enum |
| **Schedule block UUID inválido** | `entityIdSchema` en professional_id |
| **Pagos mock negativos** | `mockPaymentSchema` |
| **OTP type confusion** | `otpTypeSchema` whitelist |

RLS sigue siendo la defensa principal cross-tenant; estas validaciones añaden **defensa en profundidad**.

---

## 4. Pruebas

| Prueba | Resultado |
|--------|-----------|
| `npm run quality:gate:fast` | ✅ |
| `tests/input-validation-audit.test.ts` | ✅ 11 tests |
| Total suite | 509 passed \| 1 skipped |

---

## 5. Riesgo residual (LOW)

| Item | Recomendación futura |
|------|---------------------|
| `teams-jsonl-import` | schema Zod por fila post-JSON.parse |
| `clinical-ai` context records | cap key count / depth |
| clinic-plugins / feature-flags | `z.enum` desde registry |
| Import batch offset/limit | schema unificado import params |

---

## Archivos modificados (esta pasada)

**Nuevos schemas:**
- `src/core/validations/settings-schemas.ts`
- `src/core/validations/clinical-indicators.ts`
- `src/core/validations/professional-intake.ts`
- `src/core/validations/clinic-jobs.ts`
- `src/core/validations/auth-redirect.ts`

**Actions/routes actualizados:**
- `settings.ts`, `coverages.ts`, `professional-intake.ts`, `clinic-jobs.ts`
- `appointments.ts`, `pharmacology.ts`, `medical-orders.ts`
- `patient-chart-indicators.ts`, `load-patient-audit-trail.ts`, `patients.ts`
- `auth/confirm/route.ts`, `auth/callback/route.ts`
- `api/command-palette/patients`, `api/jobs/process`, `portal/.../manifest`

**Tests:** `tests/input-validation-audit.test.ts` (11 tests)
