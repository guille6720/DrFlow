# ReNaPDiS — Checklist de preparación

Estados: **PASS** (con evidencia verificable) · **PARTIAL** · **BLOCKED** · **NOT STARTED**.
Nada se marca PASS sin evidencia. Última actualización: 30-09-2026 (Fase 1).

## Environment Isolation — PARTIAL

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| Capa central de identidad de entorno (no depende de NODE_ENV) | PASS | `src/core/environment/isolation.mjs`, `runtime.ts`; `tests/environment-isolation.test.ts` (A–H) |
| Fail-closed en build, requests y service role | PASS | `scripts/check-environment.mjs`, `src/middleware.ts`, `createAdminClient()`; tests |
| Preview no apunta a producción | PASS | auditoría de bundles desplegados (solo ref STAGING) + `scripts/env/audit-vercel-env-refs.mjs` |
| No-prod no redirige a dominios de producción | PASS | `src/core/supabase/env.ts`; test "non-production never resolves public URLs to production hosts" |
| Separar `NEXT_PUBLIC_APP_URL` Preview/Production en Vercel | BLOCKED | entrada compartida con Production: requiere acción del owner |
| `APP_ENV` / `EXPECTED_SUPABASE_PROJECT_REF` cargadas en Vercel | NOT STARTED | defaults seguros activos |
| Badge no productivo | PASS | `EnvironmentBadge`; tests I–K |
| Health con entorno, commit y base, sin secretos | PASS | `/api/health`; test L |

## Patient Identification — PARTIAL

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| DNI/CUIL con validación de formato y dígito verificador | PARTIAL | validaciones de paciente existentes; sin validación contra fuente oficial |
| Validación de identidad contra RENAPER | NOT STARTED | sin integración |
| Protección PATIENT_MISMATCH | PASS | tests de aislamiento de paciente existentes (RCTA/PAMI launch context) |

## Professional Identification — PARTIAL

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| Capa de validación REFEPS (proveedor, estados, errores) | PARTIAL | implementada con modo sandbox; sin credenciales oficiales |
| Matrícula verificada antes de emitir receta nacional | PARTIAL | flujo presente; depende de REFEPS real |

## MFA — PARTIAL

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| TOTP habilitado y enrolamiento | PASS | `supabase/config.toml`, `prescriber-mfa.server.ts` |
| AAL2 obligatorio para emitir receta | PASS | `requireElevatedPrescriberSession` en `issuePrescription` |
| AAL2 en órdenes médicas | NOT STARTED | |
| MFA para superadmin/acciones privilegiadas | NOT STARTED | |
| MFA en login | NOT STARTED | |

## QBI2 — NOT STARTED

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| Requisitos QBI2 relevados y mapeados | NOT STARTED | sin documentación oficial en el repo |

## REFEPS — PARTIAL

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| Cliente/validador y estados | PARTIAL | capa de validación implementada (sandbox bloqueado en producción) |
| Credenciales y endpoint oficiales | BLOCKED | requiere alta formal |

## CUIR — PARTIAL

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| Ciclo de vida CUIR (estados, idempotencia, reintentos, auditoría) | PARTIAL | orquestador y migración aplicados en staging; NexClinic no emite CUIR |
| Repositorio homologado conectado | BLOCKED | requiere proveedor homologado + `RENAPDIS_HOMOLOGATION_CONFIRMED` |

## Audit — PARTIAL

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| Auditoría de recetas / bloqueos MFA sin PHI | PASS | auditoría de `requireElevatedPrescriberSession` y del orquestador |
| Export de auditoría para el fiscalizador | NOT STARTED | |

## Availability — PARTIAL

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| Health/ready/live y uptime workflow | PASS | `/api/health*`, `.github/workflows/uptime.yml` |
| SLO medido y publicado | PARTIAL | `docs/production-readiness/PHASE-4-OBSERVABILITY-SLO.md` |

## RPO/RTO — BLOCKED

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| RPO ≤ 1 h | BLOCKED | medido ~24 h, PITR no verificado (`PHASE-5-DISASTER-RECOVERY.md`) |
| RTO de restore completo medido | NOT STARTED | solo pipeline de validación medido |

## Disaster Recovery — PARTIAL

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| Tooling y drill no destructivo en staging | PASS | `npm run phase5:dr:drill`, `docs/production-readiness/PHASE-5-DISASTER-RECOVERY.md` |
| Restore cronometrado a proyecto aislado | NOT STARTED | |

## Fiscalization — BLOCKED

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| Proyecto Supabase dedicado | BLOCKED | **FISCALIZATION SUPABASE PROJECT REQUIRED** (hoy usa STAGING; builds bloqueados por diseño) |
| Arquitectura/config preparada | PASS | reglas y tests E/F/G, `PHASE-1-ENVIRONMENTS.md` §4 |
| Dataset sintético con nomenclatura RENAPDIS TEST | PARTIAL | seeds base en `supabase/seeds/fiscalization/`; falta adaptar y cargar en el proyecto dedicado |
| Cuentas revisor / médico / admin de prueba | NOT STARTED | se crean solo en el proyecto dedicado |
| Paridad de versión con producción | PARTIAL | `/api/version.commit` + procedimiento §14; sin ejecución real todavía |

## Certification — NOT STARTED

| Ítem | Estado | Evidencia / bloqueo |
|---|---|---|
| Presentación y acta de fiscalización | NOT STARTED | depende de los bloqueos anteriores |
