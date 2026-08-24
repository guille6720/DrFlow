# Fase 13 — Seguridad de exportación de datos

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-23  
**Alcance:** Staging/local. **No constituye asesoramiento legal.**

## Objetivo (PHASE 13)

Auditar exportaciones de pacientes / clínica / HC. Toda exportación con datos de salud debe:

| Control | Estado técnico |
|---------|----------------|
| Autenticación | Sesión requerida en actions |
| Autorización | Permisos + entitlements (`DATA_EXPORT`, clinical/bulk export) |
| Aislamiento tenant | `clinic_id` + `verifyPatientInClinic` / path assert |
| Auditoría | `recordAudit` / `logAudit` con `action: export` |
| Sin URLs públicas | Solo `createSignedUrl` en staging; `assertExportUrlAllowed` |
| TTL corto | `EXPORT_SIGNED_URL_TTL_SECONDS` = 10 minutos |
| Sin caché no autorizado | `cache: "no-store"` + `EXPORT_CACHE_CONTROL_NO_STORE` |

## Canales cubiertos

- Padrón CSV/XLSX (inline base64 + neutralización de fórmulas)
- Paquete clínico JSON/PDF/FHIR (inline) y ZIP (URL firmada)
- Exportación masiva asíncrona (job + signed URL)
- ARCO / Habeas Data (JSON)

## Qué se implementó / endureció

1. Módulo central **`src/core/compliance/data-export-security.ts`**
2. Staging **`src/lib/server/export-staging.ts`** — TTL, cacheControl, assert de URL
3. Descarga cliente **`download-file.ts`** — `fetch(..., { cache: "no-store" })`
4. Metadata de auditoría unificada vía `buildExportAuditMetadata`
5. Tests estáticos **`tests/data-export-security-fase13.test.ts`**

## Verificación

```bash
npx vitest run tests/data-export-security-fase13.test.ts
npx tsc --noEmit
```

## Límites / no afirmar

- La fase asegura **controles técnicos** de exportación; no certifica cumplimiento AAIP por sí sola.
- PDFs de receta / consentimiento siguen rutas propias; la matriz los documenta como canales PHI a mantener alineados.
- URLs firmadas siguen siendo compartibles durante el TTL; el control es acotar tiempo y alcance, no eliminar el riesgo de reenvío humano.

## Veredicto técnico Fase 13

**OK** — Exportaciones de salud con auth/authz, tenant, auditoría, sin URL pública, TTL corto y descarga sin caché HTTP.
