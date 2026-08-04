# Security Actions Audit Report

**Fecha:** 2026-07-30  
**Alcance:** Server Actions (`"use server"`) y API Routes (`src/app/api/**/route.ts`)  
**Stack:** Next.js 16 + Supabase  
**Objetivo:** Ninguna operación mutante o sensible debe ejecutarse solo con “usuario autenticado”; debe haber autorización explícita (rol, permiso, membership, ownership).

---

## Resumen ejecutivo

| Métrica | Valor |
|---------|-------|
| Server Action files analizados | 38 |
| API Routes analizadas | 13 |
| Vulnerabilidades HIGH corregidas | 4 |
| Vulnerabilidades MEDIUM corregidas | 2 |
| Acciones/API ya conformes | ~95% del surface mutante |
| Riesgo residual global | **Bajo** (con RLS como segunda línea) |

---

## Metodología

1. Inventario de todos los archivos con `"use server"` y rutas en `src/app/api/`.
2. Búsqueda de patrones débiles: solo `getSession()`, exports batch sin guard, `clinicId` arbitrario del cliente, respuestas vacías en lugar de 401/403.
3. Verificación de uso de `requireClinicPermission`, `hasPermission`, membership en clínica, ownership (`user.id === userId`), y scoping por `clinic_id`.
4. Refactor sin cambio funcional: extracción de procesadores batch a módulos **no** Server Action; guards explícitos en acciones expuestas.
5. Tests estáticos en `tests/security-actions-audit.test.ts` + suite existente `tests/security-p0-p1-fixes.test.ts`.

---

## Vulnerabilidades detectadas y correcciones

### HIGH — Corregidas

| Archivo | Función | Problema | Corrección | Riesgo previo |
|---------|---------|----------|------------|---------------|
| `src/lib/actions/compliance.ts` | `applyClinicLegalAcceptance` | Aceptaba `clinicId` arbitrario sin auth/autorización | Sesión + membership activa + `manageSettings` / `clinic_admin` | **Alto** — registrar aceptación legal en clínica ajena |
| `src/lib/actions/patient-import.ts` | `processConsumersImportBatchFromBuffer` | Exportada como Server Action sin guard; invocable con `clinicId` arbitrario | Movida a `src/features/pacientes/server/consumers-import-batch.ts` (sin `"use server"`) | **Alto** — import masivo de pacientes cross-tenant |
| `src/lib/actions/hce-import.ts` | `processHceImportBatchFromContent` | Idem batch HCE | Movida a `src/features/integraciones/server/hce-import-batch.ts` | **Alto** — creación de HC/adjuntos cross-tenant |
| `src/lib/actions/clinic-purge.ts` | `purgeSoleOwnerClinicsForUser` | Server Action sin verificación de ownership | Guard `user.id === userId` + lógica interna en `src/core/account/purge-sole-owner-clinics.ts` | **Alto** — borrado de clínicas de otro usuario |

### MEDIUM — Corregidas

| Archivo | Función | Problema | Corrección | Riesgo previo |
|---------|---------|----------|------------|---------------|
| `src/lib/actions/doctor-profile.ts` | `loadMyDoctorProfile`, `updateMyDoctorProfile` | Solo sesión; secretaria podía alterar teléfono de clínica vía RPC | `requireDoctorProfileAccess()` — roles `doctor`, `clinic_admin` o superadmin | **Medio** — modificación operativa no autorizada |
| `src/app/api/command-palette/patients/route.ts` | `GET` | Sin sesión devolvía `{ patients: [] }` (fail-open) | `401` sin sesión; `403` sin clínica/permiso | **Medio** — ocultamiento de auth + enumeración pasiva |

---

## Superficie ya conforme (muestra representativa)

La mayoría de acciones mutantes ya usaban guards explícitos antes de esta auditoría:

- **Pacientes / HC / recetas:** `requireClinicPermission`, `requireClinicalIssueAccess`, scoping `eq("clinic_id", clinicId)`.
- **Caja, agenda, waiting room, settings:** `requireClinicPermission` con permiso granular.
- **Farmacología:** `assertPharmacologyAccess` / `viewPharmacology` en actions y API.
- **Admin documents, import jobs, clinical import:** validación de clínica + permisos.
- **Auth / account / invitations:** flujos propios con membership o tokens.

### API Routes — estado final

| Ruta | Auth | Autorización |
|------|------|--------------|
| `/api/pharmacology` | `getUser()` → 401 | `viewPharmacology` → 403 |
| `/api/clinical-ai` | clínica activa → 401 | `viewClinicalRecords` / `editClinicalRecords` |
| `/api/admin-ops-ai` | clínica activa → 401 | permisos operativos compuestos |
| `/api/command-palette/patients` | `getSession()` → **401** (corregido) | `managePatients` \| `viewClinicalRecords` |
| `/api/jobs/process` | `CRON_SECRET` Bearer | worker interno |
| `/api/health/*`, `/api/version` | público (intencional) | N/A |
| `/api/auth/*` | flujos auth | N/A |
| `/api/observability/purge` | secret / superadmin pattern | operaciones ops |

---

## Cambios de arquitectura (sin cambio funcional)

```
src/features/pacientes/server/consumers-import-batch.ts   ← batch consumers (interno)
src/features/integraciones/server/hce-import-batch.ts     ← batch HCE (interno)
src/core/legal/apply-clinic-legal-acceptance.ts           ← legal acceptance (interno)
src/core/account/purge-sole-owner-clinics.ts              ← purge (interno)

src/lib/actions/patient-import.ts   → solo importConsumersFile (con guard)
src/lib/actions/hce-import.ts         → solo importHceExportCsv (con guard)
src/core/jobs/handlers/import-batch.ts → importa módulos internos
src/lib/actions/auth.ts               → usa applyClinicLegalAcceptanceInternal en setup
```

Los procesadores batch siguen siendo invocados por jobs con el mismo contrato; dejan de ser invocables desde el cliente vía Server Actions protocol.

---

## Riesgo residual

| Área | Nivel | Notas |
|------|-------|-------|
| Server Actions generales | **Bajo** | RLS Supabase como defensa en profundidad |
| Batch imports (jobs) | **Bajo** | Jobs encolados con auth al enqueue; path prefix validado |
| API públicas (health/version) | **Informativo** | Sin datos sensibles |
| `update_my_doctor_profile` (RPC) | **Bajo** | DB valida membership; app ahora también valida rol |
| Clinical/admin AI routes | **Bajo** | Permisos clínicos/operativos; no exponen escritura directa DB |

---

## Pruebas realizadas

| Prueba | Resultado |
|--------|-----------|
| `npm run typecheck` | ✅ Pass |
| `npm run quality:gate:fast` | ✅ Pass (491 tests + gates) |
| `tests/security-actions-audit.test.ts` | ✅ 7 tests nuevos — batch isolation, guards, API 401 |
| `tests/security-p0-p1-fixes.test.ts` | ✅ Suite existente sin regresiones |

---

## Recomendaciones futuras (fuera de alcance)

1. Añadir `getSession()` explícito en `/api/clinical-ai` y `/api/admin-ops-ai` (hoy inferido vía clínica activa).
2. Gate de CI que falle si un archivo `"use server"` exporta funciones con firma `(supabase, { clinicId, ... })` sin guard previo.
3. Extender RPC `update_my_doctor_profile` con check de rol `doctor` en Postgres.

---

## Archivos modificados en esta auditoría

- `src/features/pacientes/server/consumers-import-batch.ts` (nuevo)
- `src/features/integraciones/server/hce-import-batch.ts` (nuevo)
- `src/lib/actions/patient-import.ts`
- `src/lib/actions/hce-import.ts`
- `src/lib/actions/compliance.ts`
- `src/lib/actions/clinic-purge.ts`
- `src/lib/actions/doctor-profile.ts`
- `src/lib/actions/auth.ts`
- `src/core/legal/apply-clinic-legal-acceptance.ts`
- `src/core/account/purge-sole-owner-clinics.ts`
- `src/core/jobs/handlers/import-batch.ts`
- `src/app/api/command-palette/patients/route.ts`
- `tests/security-actions-audit.test.ts` (nuevo)
