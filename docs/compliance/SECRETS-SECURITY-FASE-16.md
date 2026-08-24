# Fase 16 — Secretos y credenciales

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-23  
**Alcance:** Staging/local. **No constituye asesoramiento legal.**

## Objetivo (PHASE 16)

Buscar exposición accidental de secretos en el repositorio versionado y documentar clases de credenciales con reglas de rotación.

| Clase | Variables | Server-only | Rotar si filtra |
|-------|-----------|-------------|-----------------|
| Supabase service_role | `SUPABASE_SERVICE_ROLE_KEY` | Sí | Sí |
| Supabase publishable | `NEXT_PUBLIC_SUPABASE_*` | No (público por diseño) | Sí |
| Postgres | `DATABASE_URL` | Sí | Sí |
| Cron | `CRON_SECRET` | Sí | Sí |
| Mercado Pago | `MP_*` / `MERCADOPAGO_*` | Sí | Sí |
| Google / Gemini | `VERTEX_*`, `GEMINI_*` | Sí | Sí |
| Clinical AI | `OPENAI_*`, `CLINICAL_AI_*` | Sí | Sí |
| Email | `RESEND_*`, `SMTP_*` | Sí | Sí |
| WhatsApp / Daily / REFEPS | respectivos `*_TOKEN`, `*_KEY` | Sí | Sí |

## Controles verificados

- `.env*` en `.gitignore` (solo `.env.example` versionado con placeholders vacíos)
- Módulos server-only para service role, billing, LLM, email, integraciones
- `scripts/security-gate.mjs` — patrones estáticos en `src/`
- Health público sin metadata de service role
- Sin `createAdminClient` en componentes UI
- Escaneo CI: `tests/secrets-security-fase16.test.ts`

## Qué se implementó

1. Módulo **`src/core/compliance/secrets-security.ts`** — catálogo + patrones de escaneo  
2. **`server-only`** en `vertex-gemini-config.ts`  
3. Tests **`tests/secrets-security-fase16.test.ts`**

## Verificación

```bash
npx vitest run tests/secrets-security-fase16.test.ts tests/env-audit.test.ts
node scripts/security-gate.mjs
npx tsc --noEmit
```

## Resultado de auditoría (repo versionado)

**Sin hallazgos de literales** en `src/`, `docs/`, `scripts/`, `supabase/`, `tests/` y archivos de config trackeados.

**No aplica `ROTACIÓN DE CREDENCIALES REQUERIDA`** por filtración en git del árbol auditado.

### Higiene operativa (fuera del repo)

- `.env.local` local está gitignored — no subir ni compartir; rotar clases afectadas si se filtró fuera de git.
- Placeholders en docs (`TU_PASSWORD`, `eyJhbG...`) son ejemplos truncados, no secretos.

## Límites / no afirmar

- El escaneo no reemplaza `git log` forense ni auditoría de Vercel/Supabase dashboards.
- Claves publishable de Supabase son públicas en el cliente por diseño; protección = RLS.
- Esta fase **no certifica** ausencia de filtraciones históricas fuera del árbol escaneado.

## Veredicto técnico Fase 16

**OK** — Repo versionado sin secretos hardcodeados; catálogo y escaneo automatizado listos. Rotación no requerida por hallazgos en código trackeado.
