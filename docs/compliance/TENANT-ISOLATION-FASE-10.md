# Fase 10 — Aislamiento multi-tenant (clinic_id)

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-23  
**Alcance:** Staging/local. **No constituye asesoramiento legal.**  
**Severidad:** Un fallo aquí es **BLOCKER** de monetización.

## Objetivo (PHASE 10)

Auditar que la Clínica A **no pueda acceder** a datos de la Clínica B en: SQL/RLS, RPCs, server actions, API routes, storage/URLs firmadas, exports, IA y endpoints admin.

## Límite de tenant

`clinic_id` (consultorio). Fuente de política: `src/core/compliance/tenant-isolation.ts`.

## Hallazgo crítico corregido

| ID | Hallazgo | Severidad | Remediación |
|----|----------|-----------|-------------|
| PUBLIC-API-RPC-1 | RPCs `api_*` (104) eran `SECURITY DEFINER` + `GRANT TO authenticated` **sin** verificar membresía de `p_clinic_id`. Un usuario autenticado de Clínica A podía invocar PostgREST con el UUID de Clínica B. | **BLOCKER** | Migración **`133_tenant_isolation_public_api.sql`**: `assert_public_api_clinic_access` (service_role \| superadmin \| miembro) al inicio de todos los `api_*`. |

## Controles verificados (OK)

| Superficie | Control |
|------------|---------|
| RLS | Manifest CI + políticas `user_clinic_ids` / `can_view_clinical` |
| App | `tenant-scope.ts`, `ownership-guard.ts` |
| Storage | Prefijo `{clinic_id}/` + `assertStoragePathInClinic` en firmas/export/jobs |
| Exports | `verifyPatientInClinic` + staging path gate |
| API sesión | `getActiveClinicId` en search / IA / observability |
| API pública | Clave → `clinic_id`; rutas pasan `auth.clinicId` al RPC |
| IA | `verifyPatientInClinic` en `/api/clinical-ai` + loaders con `clinic_id` |
| Admin | Service role con filtros `clinic_id` (jobs, reset gated) |

## Qué se reforzó en Fase 10

1. Migración **133** — tenant gate en RPCs públicos  
2. Manifest RLS — tablas 103–129 que faltaban en CI  
3. Firmas de descarga — `assertStoragePathInClinic`  
4. Clinical AI — rechazo 403 si `patientId` es de otro consultorio  
5. Tests **`tests/tenant-isolation-fase10.test.ts`**  
6. Módulo **`tenant-isolation.ts`**

## Verificación

```bash
npx vitest run tests/tenant-isolation-fase10.test.ts tests/tenant-scope.test.ts tests/rls-policies.test.ts
npx tsc --noEmit
# Staging recomendado (JWT real):
# DRFLOW_RLS_INTEGRATION=1 npx vitest run tests/cross-tenant-rls.integration.test.ts
```

Aplicar en staging: migración **133**.

## Límites / no afirmar

- Service role **bypasea RLS** — disciplina de código obligatoria.  
- Tests JWT reales siguen opcionales; ejecutarlos en staging antes de producción.  
- Superadmin puede cruzar tenants por diseño.  
- Esta fase **no certifica** cumplimiento AAIP por sí sola.

## Veredicto técnico Fase 10

**OK con remediación BLOCKER aplicada** — aislamiento multi-tenant reforzado; gap de RPCs públicos cerrado en código/migración. **Pendiente operativo:** aplicar 133 en staging y correr smoke JWT cross-tenant.
