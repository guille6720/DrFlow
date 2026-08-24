# Fase 11 — Gestión de consentimientos

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-23  
**Alcance:** Staging/local. **No constituye asesoramiento legal.**

## Objetivo (PHASE 11)

Auditar y reforzar el registro de consentimientos para que conserve, donde aplique:

| Campo | Estado |
|-------|--------|
| Paciente | ✅ `patient_id` (nullable solo a nivel consultorio) |
| Clínica | ✅ `clinic_id` |
| Finalidad | ✅ `purpose` (migración 134) |
| Versión del consentimiento | ✅ `document_version` + catálogo versionado |
| Timestamp | ✅ `granted_at` / `created_at` |
| Origen | ✅ `source` |
| Usuario responsable | ✅ `recorded_by` / `withdrawn_by` |
| Estado de retiro | ✅ `withdrawn_at` |
| Timestamp de retiro | ✅ `withdrawn_at` |

**Regla:** no sobrescribir historial previo.

## Qué ya existía

| Pieza | Estado |
|-------|--------|
| Turno web → `consent_records` | ✅ `submit_public_booking` / `record_patient_data_consent` |
| Consentimiento informado por acto | ✅ RPC `record_informed_consent` (098) |
| RLS SELECT-only (escritura vía RPC) | ✅ 058 |
| Versiones legales en `documents.ts` | ✅ |

## Gaps cerrados en Fase 11

1. **Retiro** — columnas + RPC `withdraw_patient_consent` (sin borrar el grant)
2. **Inmutabilidad** — trigger + `REVOKE UPDATE/DELETE` (solo retiro vía RPC)
3. **purpose / source** — en nuevos grants (booking + informed + signup)
4. **Signup** — `record_clinic_legal_consent` desde `applyClinicLegalAcceptanceInternal`
5. **Catálogo versionado** — `src/core/compliance/consent-management.ts`
6. **Tipo** `clinic_privacy_signup` en `CONSENT_TYPES`

## Migración

`supabase/migrations/134_consent_management.sql`

## Verificación

```bash
npx vitest run tests/consent-management-fase11.test.ts tests/informed-consent.test.ts
npx tsc --noEmit
```

Aplicar **134** en staging antes de producción.

## Límites / no afirmar

- El retiro de consentimiento informado clínico es registro técnico; el criterio médico/legal del acto ya iniciado queda fuera del producto.
- Consentimientos previos a 134 pueden tener `purpose`/`source` NULL (backfill no automático).
- Esta fase **no certifica** cumplimiento AAIP ni Ley 25.326 por sí sola.

## Veredicto técnico Fase 11

**OK** — Historial de consentimientos versionado, inmutable (salvo retiro), con signup persistido y catálogo centralizado.
