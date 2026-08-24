# Fase 14 — Seguridad de Storage (Supabase)

**Proyecto:** DrFlow  
**Rama:** `compliance/argentina-monetization`  
**Fecha:** 2026-08-23  
**Alcance:** Staging/local. **No constituye asesoramiento legal.**

## Objetivo (PHASE 14)

Auditar Supabase Storage para archivos clínicos:

| Control | Estado técnico |
|---------|----------------|
| Visibilidad del bucket | `clinical-files` con `public = false` |
| Políticas storage | SELECT/INSERT/DELETE path-aware por `clinic_id` |
| Sin UPDATE de objetos | Política UPDATE eliminada a propósito (blob inmutable) |
| URLs firmadas | Solo `createSignedUrl` / `createSignedUrls` |
| Expiración | Adjuntos 15 min · export staging 10 min · firmas 60 min |
| Rutas predecibles | Prefijo `{clinicId}/` + UUID en el nombre |
| Aislamiento clínica | RLS + `assertStoragePathInClinic` en descargas |
| Adjuntos / docs / imágenes | Superficies en matriz central |

**Regla:** ningún archivo clínico debe ser públicamente accesible sin un caso de uso explícito y justificado. En DrFlow **no hay** ese caso.

## Qué se implementó / endureció

1. Módulo **`src/core/compliance/storage-security.ts`** — matriz + TTLs + clasificación de rutas  
2. Migración **`136_storage_security.sql`** — `public=false`, path kinds (`export-staging`, `signatures`), MIME restore, sin UPDATE  
3. Descargas clínicas — TTL 15 min + assert de URL no pública  
4. Firmas profesionales — assert de prefijo `clinicId` al firmar URLs  
5. Tests **`tests/storage-security-fase14.test.ts`**

## Verificación

```bash
npx vitest run tests/storage-security-fase14.test.ts tests/file-upload-audit.test.ts
npx tsc --noEmit
```

Aplicar migración **136** en staging.

## Límites / no afirmar

- URLs firmadas siguen siendo reenviables durante el TTL (riesgo humano, no de bucket público).
- Service role bypasea RLS de storage — disciplina de código obligatoria.
- Esta fase **no certifica** cumplimiento AAIP por sí sola.

## Veredicto técnico Fase 14

**OK** — Bucket clínico privado, políticas path-aware, sin URL pública, TTL explícito y aislamiento por `clinic_id` en rutas de descarga.
