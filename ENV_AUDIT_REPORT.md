# Informe de Auditoría — Variables de Entorno y Secretos

**Fecha:** 2026-08-04  
**Alcance:** `process.env`, `NEXT_PUBLIC_*`, Supabase admin, API routes, scripts, repositorio  
**Estado post-refactor:** secretos server-only reforzados; quality gate ✅

---

## Resumen ejecutivo

| Métrica | Resultado |
|---------|-----------|
| Secretos hardcodeados en source | **0** detectados |
| Service Role en cliente | **0** — no hay imports de `createAdminClient` en UI |
| Tokens JWT en repo tracked | **0** reales (solo placeholders docs/CI) |
| `.env.local` en git | **Ignorado** correctamente |
| Riesgo global | **Bajo** con mitigaciones aplicadas |

---

## Inventario de variables

### Server-only (NUNCA en bundle cliente)

| Variable | Uso | Riesgo si filtra |
|----------|-----|------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `admin.ts`, jobs, invitaciones, purge | **CRÍTICO** — bypass RLS |
| `CRON_SECRET` | Cron auth en jobs/health/purge | **ALTO** — ejecutar workers |
| `DATABASE_URL` | Scripts migración/backup | **CRÍTICO** — acceso Postgres directo |
| `CLINICAL_AI_LLM_API_KEY` / `OPENAI_API_KEY` | LLM provider server | **ALTO** — costo/abuse API |
| `CLINICAL_AI_LLM_BASE_URL` / `MODEL` | Config LLM | Bajo |

### `NEXT_PUBLIC_*` (expuestas al cliente — intencional)

| Variable | Propósito | Riesgo |
|----------|-----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase | Bajo — público |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key | Bajo — protegida por RLS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy fallback | Bajo |
| `NEXT_PUBLIC_SITE_URL` | OAuth, emails, metadata | Bajo |
| `NEXT_PUBLIC_APP_VERSION` | Manual/ayuda | Bajo |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | Build ID en manual | Bajo |
| `NEXT_PUBLIC_VOICE_INPUT_ENABLED` | Feature flag voz | Bajo |

### Infra / runtime (no secretos)

`NODE_ENV`, `VERCEL_URL`, `DOCKER_BUILD`, `PLAYWRIGHT_*`, `HEALTH_CHECK_URL`, etc.

### Documentadas pero no usadas en código

| Variable | Notas |
|----------|-------|
| `SENTRY_DSN` | Solo `.env.example` |
| `NEXT_PUBLIC_SHOW_LABS` | **Eliminada** de `.env.example` (dead config) |

---

## Riesgos encontrados

### CRÍTICO / ALTO (mitigados)

| # | Hallazgo | Estado |
|---|----------|--------|
| 1 | Service Role en `createAdminClient()` | ✅ Solo server — `import "server-only"` añadido |
| 2 | LLM API keys en provider | ✅ `server-only` en `clinical-ai-llm-provider.server.ts` |
| 3 | Open redirect auth (`next=//evil`) | ✅ Corregido en auditoría previa (`auth-redirect.ts`) |
| 4 | Cron endpoints sin secret en dev | ⚠️ Aceptado localmente; prod exige `CRON_SECRET` |

### MEDIO (corregidos en esta pasada)

| # | Hallazgo | Mitigación |
|---|----------|------------|
| 5 | LLM provider sin `server-only` | ✅ Añadido + gate CI |
| 6 | `/api/health` exponía `serviceRole.configured` | ✅ `getPublicHealthStatus()` sin metadata interna |
| 7 | `/api/health/ready` listaba env vars faltantes | ✅ Solo expone `env.ok` |
| 8 | Cron auth duplicada en 3 routes | ✅ Centralizada en `authorizeCronRequest()` |
| 9 | Script `check-insurance-plan-column` fallback a anon key | ✅ Requiere service role |
| 10 | Mensajes de error nombraban `SUPABASE_SERVICE_ROLE_KEY` | ✅ Mensajes genéricos server-side |

### BAJO (aceptable / informativo)

| # | Hallazgo | Notas |
|---|----------|-------|
| 11 | Project ref `nipqdarduknydqptqzup` en `config.toml` | Recon — no es credencial |
| 12 | JWT truncados en `docs/LOCAL_SETUP.md` | Documentación |
| 13 | Placeholders en CI/Docker/Playwright | No son secretos reales |
| 14 | Admin panel muestra "Service role: configurada" | Solo admins autenticados |
| 15 | `/api/clinical-ai` GET expone `llmConfigured: boolean` | Requiere sesión |

---

## Service Role — mapa de uso (todo server-side)

| Archivo | Propósito |
|---------|-----------|
| `src/core/supabase/admin.ts` | Factory admin client |
| `src/lib/actions/invitations.ts` | Auth admin API (invites) |
| `src/lib/actions/clinical-reset.ts` | Borrado masivo |
| `src/core/account/purge-sole-owner-clinics.ts` | Purge cuenta |
| `src/core/jobs/process.ts` | Worker jobs |
| `src/core/observability/health.ts` | Persist health events |
| `src/core/observability/record.ts` | Telemetría |
| `src/app/api/observability/purge/route.ts` | Cron purge |
| `scripts/*.mjs` | Ops/migraciones |

**Verificación:** `security-gate.mjs` falla si UI importa `createAdminClient` o `SUPABASE_SERVICE_ROLE`.

---

## Refactors aplicados

| Cambio | Archivo(s) |
|--------|------------|
| `import "server-only"` | `admin.ts`, `env.server.ts`, `clinical-ai-llm-provider.server.ts` |
| Health público vs interno | `health.ts`, `/api/health`, `/api/health/ready` |
| Cron auth unificada | `jobs/process`, `observability/purge` → `cron-auth.ts` |
| Script sin fallback anon | `check-insurance-plan-column.mjs` |
| Mensajes sin nombres de env | `invitations.ts`, `clinical-reset.ts`, `purge-sole-owner-clinics.ts` |
| Gate CI server-only modules | `security-gate.mjs` |
| Patrones LLM keys hardcoded | `security-gate.mjs` |
| Tests auditoría env | `tests/env-audit.test.ts` |
| `.env.example` clarificado | Server-only section, removed dead SHOW_LABS |

---

## Vectores eliminados / reducidos

| Vector | Mitigación |
|--------|------------|
| **Bundle leak de service role** | `server-only` + architecture/security gates |
| **Bundle leak de LLM keys** | `server-only` en provider |
| **Recon vía health endpoint** | Payload público reducido |
| **Recon vía ready endpoint** | No lista `missing` env vars |
| **Info disclosure en errores** | Mensajes genéricos a admins |
| **Cron abuse en prod** | `CRON_SECRET` obligatorio si `NODE_ENV=production` |
| **Commit accidental de secretos** | `.gitignore` + scan JWT/hardcoded en CI |

---

## Checklist producción (Vercel)

| Variable | Requerida prod |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ |
| `NEXT_PUBLIC_SITE_URL` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (jobs, invites, observability) |
| `CRON_SECRET` | ✅ (≥16 chars) |
| `CLINICAL_AI_LLM_API_KEY` | Opcional |
| `DATABASE_URL` | Solo scripts locales/CI ops |

Validación: `validateProductionEnv()` en `instrumentation.ts` / ready probe.

---

## Pruebas

| Prueba | Resultado |
|--------|-----------|
| `tests/env-audit.test.ts` | ✅ 4 tests |
| `scripts/security-gate.mjs` | ✅ server-only modules |
| Grep JWT en source | ✅ 0 tokens reales |

---

## Recomendaciones futuras

1. Rotar `CRON_SECRET` y service role si alguna vez estuvieron en logs/commits.
2. Restringir `/api/clinical-ai` GET metadata a admins (opcional).
3. Implementar o remover `SENTRY_DSN` si se adopta Sentry.
4. En staging, considerar exigir `CRON_SECRET` igual que prod.
