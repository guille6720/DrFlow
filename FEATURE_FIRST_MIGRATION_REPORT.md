# Feature First Migration Report

**Fecha:** 2026-07-30  
**Alcance:** Fase 1 — eliminar `src/lib` como contenedor genérico para módulos de plataforma y dominios clínicos core  
**Estado:** ✅ TypeScript compila · ✅ Quality gate (`quality:gate:fast`) pasa · Comportamiento funcional sin cambios

---

## Resumen ejecutivo

Se migraron **147 módulos** desde `src/lib/` hacia una arquitectura **Feature First + DDD**:

| Destino | Rol | Módulos |
|---------|-----|---------|
| `src/core/` | Plataforma transversal (Supabase, auth, security, jobs, observability, validations…) | 68 |
| `src/shared/` | Utilidades cross-feature sin dominio | 4 |
| `src/features/pacientes/` | Dominio pacientes (actions → services → repositories) | 35 |
| `src/features/historias/` | Historias clínicas / consultas | 12 |
| `src/features/recetas/` | Recetas y órdenes médicas | 11 |
| `src/features/agenda/` | Citas | 4 |
| `src/features/dashboard/` | Ops dashboard clínico | 7 |
| `src/features/configuracion/` | Repositorio de clínicas | 1 |
| `src/features/caja/` | Hook de caja | 1 |
| `src/features/flags/lib/` | Feature flags (registry + resolve) | 2 |

En cada ruta original quedó un **stub de transición** `@deprecated` que re-exporta desde la nueva ubicación, preservando compatibilidad hacia atrás con imports `@/lib/...`.

---

## Archivos movidos (147)

### `src/core/` — plataforma (68 archivos)

- **Supabase:** `admin`, `client`, `client-public-url`, `env`, `middleware`, `server`
- **Auth:** `dashboard-page`, `session`
- **Permissions:** `roles`
- **Security:** `audit`, `audit-context`, `audit-log`, `audit-types`, `csrf`, `response-headers`, `rls-manifest`, `tenant-scope`
- **Observability:** `cron-auth`, `dev-log`, `health`, `index`, `record`, `trace-id`, `types`
- **Jobs:** `enqueue`, `process`, `registry`, `types` + handlers (`generate-report`, `import-batch`, `import-clinical-pdf`, `run-ai-task`, `send-reminder`, `index`)
- **Legal:** `documents` + content (backups, cookies, privacy, security, software-licenses, terms, types)
- **Accessibility:** `constants`, `focus`, `index`, `read-reduced-motion`
- **Validations:** `cash-schemas`, `doctor-setup`, `form-errors`, `public-booking`, `schemas`
- **Infra:** `env.server.ts`, `app-release.ts`, `clinic-guard`, `clinical-access.service`, repository/service `types`
- **Otros:** `trial/clinic-trial`, `manual/manual-data`, `qa/checklist-data`, `booking/slots`, `enterprise/phases`, `theme/ui-theme`
- **Hooks shell:** `use-login-form`, `use-register-clinic-form`, `use-restablecer-password`, `use-user-account-modal`, `use-client-mounted`, `use-command-palette-*`, `use-completed-ops-tasks`

### `src/shared/utils/` (4 archivos)

- `cn.ts`, `stabilization-limits.ts`, `clinical-navigation.ts`, `clinic-timezone.ts`

### `src/features/pacientes/` (35 archivos)

- **Actions:** `patients`, `patient-chart-indicators`, `patient-attachments`, `patient-app-share`
- **Services:** `patients.service`, `patient-chart-indicators.service`
- **Repositories:** `patients.repository`, `patient-clinical-profile.repository`
- **Server loaders:** `load-pacientes-page`, `load-patient-workspace-page`, `load-patient-ehr-data`, `load-patient-audit-trail`, `patient-clinical-profile`
- **Hooks:** 8 hooks de workspace/EHR/chart/portal
- **Utils:** 12 utilidades de paciente (age, chart, ehr, search, messages…)
- **Constants:** `patient-workspace-tabs`

### `src/features/historias/` (12 archivos)

- Stack completo: `clinical-records` (action/service/repository), loaders, 6 hooks de consulta

### `src/features/recetas/` (11 archivos)

- Stack completo: prescriptions + medical-orders (actions/services/repositories), loader, 3 hooks

### `src/features/agenda/` (4 archivos)

- `appointments.repository` + 3 hooks de agenda

### `src/features/dashboard/` (7 archivos)

- `load-clinical-operations-dashboard` + utils de ops/admin metrics

### Otros dominios (4 archivos)

- `src/features/configuracion/repositories/clinics.repository.ts`
- `src/features/caja/hooks/use-cash-register.ts`
- `src/features/flags/lib/registry.ts`, `resolve.ts`

---

## Imports corregidos

| Métrica | Valor |
|---------|-------|
| Rutas de import actualizadas automáticamente | **457** |
| Archivos tocados | `src/`, `tests/`, `scripts/` |
| Alias TypeScript nuevos | `@/core/*`, `@/shared/*`, `@/features/*` (en `tsconfig.json`) |

### Patrón de transición (147 stubs)

```typescript
/** @deprecated Use @/core/supabase/server */
export * from "@/core/supabase/server";
```

Los consumidores que aún importan `@/lib/supabase/server` siguen funcionando; el compilador resuelve al módulo real en `src/core/`.

### Tests actualizados manualmente (3)

Rutas que leían contenido fuente (no solo imports) apuntaban a stubs vacíos:

- `tests/audit-phase12.test.ts` → `src/features/pacientes/constants/patient-workspace-tabs.ts`
- `tests/phase19-infrastructure.test.ts` → `src/core/supabase/middleware.ts`
- `tests/security-p0-p1-fixes.test.ts` → `src/core/jobs/handlers/import-*.ts`

---

## Dependencias cruzadas eliminadas / reducidas

1. **Dominios clínicos desacoplados de `lib` genérico:** pacientes, historias, recetas y agenda ya no comparten el mismo bucket que Supabase o auth.
2. **Plataforma centralizada en `core`:** un único origen para `@/core/supabase/*`, `@/core/security/*`, `@/core/jobs/*` — evita que features importen entre sí vía `lib`.
3. **Utilidades compartidas acotadas:** solo 4 helpers en `shared/`; el resto vive en su feature o en `core`.
4. **Barrels de feature actualizados:** `src/features/{core,pacientes,historias,recetas}/index.ts` exportan desde las nuevas rutas.
5. **Gates alineados con la nueva estructura:**
   - `eslint.config.mjs` — excepción `no-console` en `src/core/observability/dev-log.ts`
   - `scripts/code-quality-gate.mjs` — allowlist de console en `core/`
   - `scripts/security-gate.mjs` — RLS manifest en `src/core/security/`
   - `scripts/architecture-gate.mjs` — escanea hooks en `core/hooks/` y `features/*/hooks/`

### Imports `@/lib/` restantes (Fase 2 pendiente)

Aún existen **~250 referencias** a `@/lib/` en el codebase (mayoría legítimas: código no migrado + stubs + barrels de feature que re-exportan acciones legacy). Desglose de **117 archivos reales** que siguen en `src/lib/`:

| Carpeta | Archivos |
|---------|----------|
| `utils/` | 56 |
| `actions/` | 29 |
| `constants/` | 13 |
| `hooks/` | 8 |
| `server/` | 6 |
| `services/` | 4 |
| `features/` | 1 |

Estos módulos **no cambiaron de comportamiento**; permanecen en `lib` hasta la siguiente fase.

---

## Validación

| Check | Resultado |
|-------|-----------|
| `npm run typecheck` | ✅ Pasa |
| `npm run quality:gate:fast` | ✅ Pasa (484 tests, lint, security, architecture, coverage, perf, RLS static) |
| Build de producción | No ejecutado en esta fase (`--skip-build`) |

---

## Scripts de migración

- `scripts/feature-first-migrate.mjs` — mueve módulos, escribe stubs, reescribe imports
- `scripts/fix-transition-paths.mjs` — corrige `@/src/...` → `@/...` en stubs

Re-ejecutar el migrador es idempotente: omite destinos existentes y stubs `@deprecated`.

---

## Posibles mejoras futuras (Fase 2+)

### Alta prioridad — completar migración de `src/lib/`

| Dominio objetivo | Contenido pendiente en `lib/` |
|------------------|-------------------------------|
| `features/ia/` | `clinical-ai-orchestrator`, `clinical-copilot*`, `clinical-assistant`, LLM provider |
| `features/pharmacology/` | actions, hooks (`use-pharmacology-search`, `use-deferred-pathology-search`) |
| `features/pami/` | hooks, constants, utils |
| `features/caja/` | `cash-register` action + server loaders |
| `features/agenda/` | `appointments` action |
| `features/configuracion/` | settings, invitations, feature-flags, plugins, compliance actions |
| `features/profesionales/` | professional-intake action + hooks |
| `features/integraciones/` | imports (HCE, PDF, CSV, Teams JSONL, patient-import) |
| `features/portal/` | portal utils |
| `core/` | reminders service, command-palette constants |

### Media prioridad — deuda técnica

1. **Eliminar stubs `@/lib/`** tras actualizar todos los imports (~250 refs restantes) y añadir regla ESLint `no-restricted-imports` para `@/lib/*`.
2. **Actualizar gates de cobertura** (`tests/coverage-scope.ts`, `scripts/critical-coverage-rules.mjs`) para apuntar a `core/` y `features/` en lugar de `lib/`.
3. **Stabilization gate:** permitir hooks en `features/*/hooks/` además de `lib/hooks/` (hoy solo valida `lib/hooks` para “hooks fuera de components”).
4. **Barrels por capa DDD:** exportar públicamente solo `actions/`, `hooks/`, tipos — ocultar `repositories/` y `services/` como detalle interno del feature.
5. **Boundary lint:** regla que impida `features/A` → `features/B/repositories` (solo vía API pública del feature).

### Baja prioridad

- Mover componentes UI grandes (>200 líneas) listados en architecture gate.
- Consolidar `features/ia/index.ts` (19 re-exports desde `@/lib/`) como fachada única del dominio IA.
- Documentar mapa de bounded contexts en `ARCHITECTURE.md`.

---

## Estructura objetivo (post Fase 1)

```
src/
├── core/           # Plataforma: supabase, auth, security, jobs, observability…
├── shared/         # Utils sin dominio (cn, timezone, navigation)
├── features/
│   ├── pacientes/  # actions → services → repositories
│   ├── historias/
│   ├── recetas/
│   ├── agenda/
│   ├── dashboard/
│   ├── configuracion/
│   ├── caja/
│   └── flags/
├── components/     # UI (sin lógica de negocio)
└── lib/            # ⚠ Legacy + stubs @deprecated (117 módulos reales + 147 stubs)
```

---

## Conclusión

La **Fase 1** establece los cimientos Feature First: plataforma en `core/`, dominios clínicos core en `features/`, compatibilidad vía stubs, y **457 imports** actualizados sin cambio funcional. Queda **~44% del código TypeScript de `lib/`** (117/264 archivos) para migrar en fases posteriores, principalmente IA, integraciones, configuración y utilidades clínicas auxiliares.
