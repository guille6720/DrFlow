# ReNaPDiS — Fase 1: aislamiento de entornos y preparación para fiscalización

> Estado: **PARCIAL**. La capa de aislamiento está implementada y testeada. Falta el **proyecto Supabase dedicado de
> fiscalización** (FISCALIZATION SUPABASE PROJECT REQUIRED) y el enforcement completo de MFA.
>
> Este documento no contiene valores secretos. Los refs de proyectos se identifican por etiqueta
> (PRODUCTION / STAGING / FISCALIZATION); los identificadores viven en `src/core/environment/isolation.mjs`.

## 1. Diagrama de arquitectura

```
                       ┌──────────────────── mismo commit (paridad) ────────────────────┐
                       │                                                                 │
  Desarrollo (local)   │   Staging (Vercel Preview)      Fiscalización (Vercel custom     Producción (Vercel Production)
  APP_ENV=development  │   APP_ENV=staging               env "fiscalizacion")             APP_ENV=production
        │              │         │                       APP_ENV=fiscalization                   │
        ▼              │         ▼                              │                                ▼
  Supabase local /     │   Supabase STAGING              Supabase FISCALIZATION           Supabase PRODUCTION
  placeholder/STAGING  │   (datos de prueba)             (SOLO sintéticos, proyecto       (datos reales, PHI)
  (nunca PRODUCTION)   │                                  propio — PENDIENTE DE CREAR)
                       │
  Capa única de aislamiento: src/core/environment/isolation.mjs
    ├─ build:      scripts/check-environment.mjs (invocado por scripts/next-build.mjs y CI) → aborta el build
    ├─ requests:   src/middleware.ts → 503 para páginas, API, server actions y crons
    ├─ service role: createAdminClient() → excepción (defensa en profundidad)
    ├─ arranque:   src/instrumentation.ts → error explícito en logs
    ├─ URLs:       src/core/supabase/env.ts → no-prod nunca resuelve dominios de producción
    ├─ health:     /api/health → environment, commit, database, códigos de aislamiento
    └─ UI:         EnvironmentBadge → "STAGING" / "FISCALIZACIÓN" (nunca en producción)
```

## 2. Entorno de desarrollo

- `APP_ENV` ausente y sin `VERCEL` ⇒ `development` (no se usa `NODE_ENV`).
- Puede usar Supabase local, un placeholder (CI) o STAGING. **Nunca PRODUCTION** (`NON_PRODUCTION_USES_PRODUCTION_DB`).
- `next dev` no ejecuta el check de build; el middleware sí bloquea si el `.env.local` apunta a producción.
- Sin badge (evita ruido en desarrollo).

## 3. Entorno de staging

- Vercel **Preview** (`VERCEL_TARGET_ENV=preview`) ⇒ `staging`, o `APP_ENV=staging` explícito.
- Proyecto esperado por defecto: STAGING. Se puede fijar con `EXPECTED_SUPABASE_PROJECT_REF`.
- Badge visible: **STAGING**.
- Las URLs públicas que apunten a dominios de producción se **ignoran** (ver §7, causa raíz detectada).

## 4. Entorno de fiscalización

- Vercel custom environment **`fiscalizacion`** (`VERCEL_TARGET_ENV=fiscalizacion`) ⇒ `fiscalization`, o `APP_ENV=fiscalization`.
- **Requiere** `EXPECTED_SUPABASE_PROJECT_REF` y debe ser un proyecto **dedicado**: no puede ser STAGING ni PRODUCTION
  (`FISCALIZATION_PROJECT_NOT_DEDICATED`, `FISCALIZATION_USES_STAGING_DB`).
- Solo datos sintéticos (§9). Sin copias de producción. Badge visible: **FISCALIZACIÓN**.
- **Estado actual: BLOQUEADO.** El entorno Vercel `fiscalizacion` hoy apunta a Supabase STAGING. Desde esta fase,
  sus builds fallan cerrado hasta que exista el proyecto dedicado. Es intencional.

### FISCALIZATION SUPABASE PROJECT REQUIRED — valores a configurar cuando exista

Solo en el entorno Vercel `fiscalizacion` (nunca en Production ni en Preview):

| Variable | Valor esperado |
|---|---|
| `APP_ENV` | `fiscalization` |
| `NEXT_PUBLIC_APP_ENV` | `fiscalization` |
| `EXPECTED_SUPABASE_PROJECT_REF` | ref del nuevo proyecto de fiscalización |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref-fiscalizacion>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key del nuevo proyecto (marcar Sensitive) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role del nuevo proyecto (Sensitive, server-only) |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | `https://fiscalizacion.drflow.opusorg.com` |
| `CRON_SECRET` | secreto propio del entorno |

Pasos en el proyecto nuevo: aplicar las migraciones del repo (mismo commit que producción) con el CLI enlazado a ese
ref, configurar Auth (Site URL y redirects del dominio de fiscalización, TOTP habilitado) y cargar los seeds
sintéticos de `supabase/seeds/fiscalization/` adaptados a la política del §9.

## 5. Entorno de producción

- Vercel **Production** ⇒ `production`, o `APP_ENV=production`.
- Proyecto esperado: PRODUCTION. Si apunta a STAGING (`PRODUCTION_USES_STAGING_DB`) o a otro ref declarado
  (`PRODUCTION_EXPECTS_OTHER_DB`), falla cerrado.
- Sin badge. El comportamiento de URLs no cambia (el dominio canónico sigue siendo el de producción).
- En esta fase **no se modificaron** variables, datos, usuarios ni despliegues de producción.

## 6. Reglas de aislamiento Supabase

Evaluadas por `evaluateEnvironmentIsolation(env)`; los errores son códigos estables, sin refs ni secretos.

| Código | Condición |
|---|---|
| `APP_ENV_UNKNOWN` | `APP_ENV` inválido o entorno Vercel custom no mapeado |
| `SUPABASE_URL_MISSING` / `SUPABASE_REF_UNRESOLVED` | entorno desplegado sin proyecto Supabase identificable |
| `NON_PRODUCTION_USES_PRODUCTION_DB` | cualquier entorno no productivo con URL o clave JWT de PRODUCTION |
| `PRODUCTION_USES_STAGING_DB` | producción conectada a STAGING |
| `FISCALIZATION_USES_STAGING_DB` | fiscalización conectada a STAGING |
| `EXPECTED_SUPABASE_PROJECT_REF_REQUIRED` | fiscalización sin ref esperado |
| `FISCALIZATION_PROJECT_NOT_DEDICATED` | fiscalización declarando STAGING/PRODUCTION como propio |
| `NON_PRODUCTION_EXPECTS_PRODUCTION_DB` / `PRODUCTION_EXPECTS_OTHER_DB` | ref esperado inconsistente con el entorno |
| `SUPABASE_PROJECT_MISMATCH` | ref esperado ≠ ref de la URL |
| `SERVICE_ROLE_PROJECT_MISMATCH` / `PUBLISHABLE_KEY_PROJECT_MISMATCH` | claim `ref` de una clave JWT legacy ≠ ref de la URL |

Advertencia (no bloquea): `NON_PRODUCTION_PUBLIC_URL_POINTS_TO_PRODUCTION:<VAR>`.

Las claves nuevas opacas (`sb_publishable_…`, `sb_secret_…`) no llevan ref y no pueden cruzarse. La protección
efectiva es la URL más el proyecto esperado.

API de servidor (`src/core/environment/runtime.ts`): `getRuntimeEnvironment()`, `isProduction()`, `isStaging()`,
`isFiscalization()`, `assertNonProduction()`, `assertExpectedSupabaseProject()`, `getEnvironmentIsolation()`.

## 7. Scopes de variables en Vercel

Auditoría de solo lectura: `node scripts/env/audit-vercel-env-refs.mjs <preview|production|fiscalizacion> [--git-branch=…]`.
Imprime nombre / presencia / destino, nunca valores.

Hallazgos del 30-09-2026:

- **Preview (general y rama `release/0.2.19-staging-promotion`)**: `NEXT_PUBLIC_SUPABASE_URL` → STAGING. Todos los
  bundles Preview desplegados desde el 28-09 contienen solo el ref de STAGING. **Ninguna Preview apunta a la base de
  producción.**
- **Causa raíz del síntoma "Preview termina en producción"**: `NEXT_PUBLIC_APP_URL` es una entrada **compartida
  Preview + Production** con el dominio de producción. `getSiteUrl()`/`getPublicSiteUrl()` la priorizaban, así que los
  emails de auth (reset de contraseña) y los redirects de Preview llevaban al sitio de producción. Además, el fallback
  por defecto era un host de producción. **Corregido en código**: en no-producción esos hosts se ignoran.
- Entrada con typo `NEXT_PUBLIC_SITE_UR` (Preview + Production): no la lee ningún código.
- `SUPABASE_SERVICE_ROLE_KEY` de Preview general es Sensitive (ilegible por CLI). La URL es STAGING, así que no puede
  alcanzar producción. Si fuese una clave JWT legacy de otro proyecto, el build la rechaza (`SERVICE_ROLE_PROJECT_MISMATCH`).
- **fiscalizacion**: URL y publishable key → STAGING. Viola el aislamiento (ver §4).
- No definidas en ningún scope: `APP_ENV`, `NEXT_PUBLIC_APP_ENV`, `EXPECTED_SUPABASE_PROJECT_REF` (hay defaults seguros
  para Preview/Production).

Cambios recomendados (solo Preview / fiscalizacion; **no** tocar Production):

1. Separar `NEXT_PUBLIC_APP_URL`: quitar el scope Preview de la entrada compartida (o crear una entrada solo-Preview
   con la URL de staging). Lo hace el owner en el dashboard, porque editar la entrada compartida afecta a Production.
2. Eliminar la entrada `NEXT_PUBLIC_SITE_UR` (typo). Es compartida con Production, así que la decide el owner.
3. Preview: `APP_ENV=staging`, `NEXT_PUBLIC_APP_ENV=staging`, `EXPECTED_SUPABASE_PROJECT_REF=<ref STAGING>`.
4. Production (cuando el owner lo apruebe, en una ventana propia): `APP_ENV=production`,
   `NEXT_PUBLIC_APP_ENV=production`, `EXPECTED_SUPABASE_PROJECT_REF=<ref PRODUCTION>`. No es necesario para que funcione:
   Production ya tiene default seguro.
5. fiscalizacion: la tabla del §4 cuando exista el proyecto.

## 8. Controles de seguridad del despliegue

| Punto | Mecanismo | Resultado ante fallo |
|---|---|---|
| CI | paso `npm run check:environment` en `.github/workflows/ci.yml` | job falla |
| Build (local y Vercel) | `scripts/next-build.mjs` ejecuta `scripts/check-environment.mjs` antes de `next build` | build abortado, deploy no se publica |
| Runtime (requests) | `src/middleware.ts` + `src/core/environment/guard.ts` | 503 con códigos (health/version siguen accesibles) |
| Service role | `createAdminClient()` → `assertExpectedSupabaseProject()` | excepción, no se crea el cliente |
| Arranque | `src/instrumentation.ts` | error explícito en logs |
| Health | `/api/health` no sondea una base rechazada | `status: "locked"`, `database: "blocked_by_isolation"` |

## 9. Política de datos sintéticos

- **Prohibido**: copiar, clonar o anonimizar datos de producción hacia fiscalización o staging. Nada de PHI real.
- Toda la data de fiscalización es ficticia, identificable a simple vista y reproducible desde seeds versionados.
- Dataset mínimo:
  - Clínica: **CENTRO MEDICO RENAPDIS TEST** (`clinics.is_fiscalization = true`).
  - Profesionales: **RENAPDIS PROFESIONAL 001**, **RENAPDIS PROFESIONAL 002** (matrículas ficticias, sin coincidencia REFEPS real).
  - Pacientes: **RENAPDIS PACIENTE 001**, **002**, **003** con documentos del rango sintético `90000001…` y CUIL de prueba válido por dígito verificador.
  - Coberturas, una por tipo: **PAMI**, **obra social**, **prepaga**, **particular**.
- Seeds base existentes: `supabase/seeds/fiscalization/` (hoy apuntan a staging; deben renombrarse a la nomenclatura
  anterior y ejecutarse **solo** contra el proyecto de fiscalización, verificando el ref enlazado antes de correrlos).
- Las contraseñas no se versionan: las cuentas se crean por invitación o con contraseña generada y entregada fuera
  de banda.

## 10. Política de acceso

| Rol de fiscalización | Rol app | Alcance |
|---|---|---|
| Revisor / fiscalizador | `secretary` (solo lectura operativa) | ver recetas, auditoría y documentos de la clínica de prueba |
| Médico de prueba | `doctor` | emitir recetas/órdenes con TOTP (AAL2) |
| Admin de clínica de prueba | `clinic_admin` | gestión de la clínica de prueba |

- Cuentas **solo** en el proyecto de fiscalización. **Nunca** en producción.
- MFA TOTP obligatorio para el médico de prueba. Recomendado para todos los demás.
- Sin superadmin para terceros. Accesos con fecha de expiración y revocación al cerrar la fiscalización.

## 11. Preparación MFA — **PARCIAL**

| Aspecto | Estado | Evidencia |
|---|---|---|
| TOTP habilitado | PASS | `supabase/config.toml` `[auth.mfa.totp]` enroll/verify |
| Enrolamiento y verificación | PASS | `src/core/auth/prescriber-mfa.server.ts` + sección RENAPDIS del profesional |
| AAL2 al emitir receta | PASS | `requireElevatedPrescriberSession` en `issuePrescription` (bloqueos auditados) |
| AAL2 en órdenes médicas | MISSING | no se exige |
| MFA para superadmin / acciones privilegiadas | MISSING | no se exige |
| MFA en el login | MISSING | opcional |
| Recuperación / reset de factores | PARTIAL | vía soporte Supabase; sin flujo in-app |

Sin cambios grandes de MFA en esta fase, por alcance.

## 12. Endpoint de health

`GET /api/health` (público, `no-store`):

```json
{
  "ok": true,
  "status": "ok | degraded | locked",
  "environment": "staging",
  "version": "0.2.36",
  "buildId": "abc1234",
  "commit": "<sha completo>",
  "database": "connected | unreachable | not_configured | blocked_by_isolation",
  "environmentIsolation": { "ok": true, "errors": [] },
  "checks": { "supabase": { "ok": true, "latencyMs": 42 }, "memory": { "ok": true }, "env": { } }
}
```

No expone URLs, refs, claves ni valores de variables (test L). `/api/health/live`, `/api/health/ready` y
`/api/version` (con `commit`) siguen accesibles aun con el entorno bloqueado.

## 13. Brechas conocidas

1. **Proyecto Supabase de fiscalización inexistente.** El entorno `fiscalizacion` usa STAGING y queda bloqueado por diseño.
2. `NEXT_PUBLIC_APP_URL` compartida Preview + Production con dominio de producción. Mitigado en código; falta separarla en Vercel (owner).
3. Typo `NEXT_PUBLIC_SITE_UR` sin eliminar (entrada compartida con Production).
4. Claves opacas `sb_*`: no se puede verificar su proyecto sin llamadas de red. Se confía en URL + ref esperado.
5. MFA no exigido en órdenes, login ni superadmin (§11).
6. `APP_ENV` / `EXPECTED_SUPABASE_PROJECT_REF` aún no cargadas en Vercel. Rigen los defaults seguros por target.
7. Staging comparte proyecto Supabase entre todas las ramas Preview.
8. Antecedente: el 28-09, con aprobación del usuario, se limpió `trial_ends_at` de una clínica de producción. En Fase 1
   no se escribió nada en producción.

## 14. Procedimiento de paridad de versión (fiscalización = producción)

1. Producción se despliega desde un commit `X` (tag de release).
2. Fiscalización se despliega **desde el mismo commit** `X`: `vercel deploy --target=fiscalizacion` sobre el checkout
   del tag, o "Redeploy" del mismo commit en el entorno custom.
3. Verificación:
   ```bash
   curl -s https://nexclinic.opusorg.com/api/version | jq -r .commit
   curl -s https://fiscalizacion.drflow.opusorg.com/api/version | jq -r .commit
   ```
   Los dos SHA deben ser idénticos. `/api/health` además muestra `environment` y `environmentIsolation.ok = true`.
4. Registrar fecha, SHA y resultado en el acta de fiscalización. Las migraciones aplicadas se comparan con
   `supabase_migrations.schema_migrations` en ambos proyectos (solo lectura).
