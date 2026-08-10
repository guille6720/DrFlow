# DrFlow — Auditoría N+1 (PROMPT 04)

**Fecha:** 2026-08-10  
**Objetivo:** Reducir round trips a Postgres/Storage en listados y metadatos de clínica.

---

## Resumen ejecutivo

| Área | Antes | Después | Ahorro |
|------|-------|---------|--------|
| Búsqueda por patología (`/pacientes?patologia=`) | T queries (1 por token) | 1 RPC | **T−1 round trips** (T ≈ 1–4) |
| Firmas profesionales (cache / historia / recetas) | N `createSignedUrl` | 1 `createSignedUrls` | **N−1 storage calls** |
| Conteo consultas en listado pacientes | JOIN `professionals→profiles` por fila | SELECT columnas clínicas | **1 query más liviana** |
| Tab Historias en `/pacientes` | `loadPacientesPageData` + historias | Solo historias | **~3–5 queries evitadas** |

**Áreas ya optimizadas (sin cambios):** agenda, dashboard ops, historias list (joins + RPC), PAMI planillas, órdenes médicas en workspace.

---

## Cambios implementados

### 1. RPC `search_patient_ids_by_pathology` (089)

- **Archivo:** `supabase/migrations/089_n_plus_one_rpcs.sql`
- **Reemplaza:** loop en `findPatientIdsByPathologySearch` (`patient-search.ts`)
- **RLS:** `SECURITY INVOKER` — respeta políticas de `clinical_records`
- **Lógica:** AND entre tokens; ILIKE en `diagnosis` y `chief_complaint`
- **Fallback JS:** si RPC no existe, mantiene comportamiento anterior

### 2. Batch de URLs de firma

- **Archivo:** `resolve-professional-signature-urls.ts`
- **Antes:** `Promise.all(professionals.map(createSignedUrl))` → N llamadas
- **Después:** deduplica paths → `createSignedUrls(paths[])` → 1 llamada
- **Casos:** 0 paths → 0 calls; 1 path → `createSignedUrl`; 2+ → batch

### 3. Conteo consultas — sin JOIN profesional

- **Archivo:** `batch-patient-record-counts.ts`
- El conteo sidebar no usa nombre del profesional salvo fallback HCE
- Elimina JOIN anidado `professionals→profiles` del batch de conteo

### 4. Tab Historias — skip loader pacientes

- **Archivo:** `pacientes/page.tsx`
- Cuando `seccion=historias`, no ejecuta `loadPacientesPageData` (evita conteo consultas + portal + shares)

---

## Round trips estimados por pantalla

| Pantalla | Antes (typical) | Después | Notas |
|----------|-----------------|---------|-------|
| `/pacientes` (20 filas) | 1 pacientes + 1 records + 1 attachments + ≤20 storage | 1 + 1 + 1 + ≤20 storage* | *storage solo si hay HCE |
| `/pacientes?patologia=hta dm` | +2 queries tokens | +1 RPC | tokens=2 |
| `/pacientes?seccion=historias` | 6–8 queries | 3–4 queries | skip listado pacientes |
| Profesionales cache (10 firmas) | 10 storage | 1 storage | batch URLs |
| `/turnos/agenda` | 1 query joins | sin cambio | ya OK |
| Dashboard ops | 6–7 parallel | sin cambio | ya OK |

---

## Patrones descartados (no N+1 de listado)

| Patrón | Motivo |
|--------|--------|
| Import workers (`clinical-import`, HCE batch) | Procesamiento batch intencional |
| Job processor (`process.ts`) | Secuencial por diseño |
| `sendReminder` | Acción unitaria del usuario |
| Descarga adjunto EHR al click | Lazy load correcto |

---

## Medición recomendada

```sql
-- Patología: EXPLAIN una sola búsqueda vs loop
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM search_patient_ids_by_pathology(
  '<clinic_id>'::uuid,
  'hipertension diabetes'
);
```

DevTools → Network: contar requests PostgREST en `/pacientes` con y sin `patologia`, y en tab historias.

Observability: métrica `load_pacientes_page` duration antes/después en staging.

---

## Deploy

Aplicar migración **089** después de **087** y **088**.

---

## Riesgos

- RPC patología: requiere `escape_ilike_pattern` (087)
- Conteo sidebar sin profesional: fallback `"Profesional"` / `"Importación HCE"` — mismo comportamiento visible
- Tab historias: `pageData` vacío no afecta UI (solo usa `historiasData`)
