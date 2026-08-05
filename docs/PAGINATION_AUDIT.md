# Informe de paginación — DrFlow

Auditoría e implementación (2026-07-30).

## Resumen

Se auditó el proyecto buscando consultas que devuelven listas. El patrón existente (`range` + `count: exact` + `ListPagination`) se extendió a nuevas vistas y se centralizaron constantes y helpers en `src/core/supabase/pagination.ts`.

| Estrategia | Cuándo usar | Ejemplos |
|------------|-------------|----------|
| **Offset + range** | Listas indexadas con `?page=`, orden estable | Pacientes, historias, atenciones, PAMI |
| **Límite fijo + búsqueda API** | Pickers/comboboxes | Command palette, PatientSearchCombobox remote |
| **RPC agregado** | Estadísticas sin fetch-all | Reporte mensual, resumen atenciones |
| **Límite de seguridad** | Ventanas acotadas por fecha | Agenda (1000 turnos / ventana) |
| **Cursor (helpers)** | Preparado para feeds temporales | `encodeDescCursor` / `parseDescCursor` |

---

## Ya paginadas (sin cambios funcionales)

| Vista | Tamaño | Mecanismo |
|-------|--------|-----------|
| `/pacientes` | 20 | `loadPacientesPageData` → `.range()` |
| `/historias` | 25 | `loadHistoriasPageData` → `.range()` |

Constantes movidas a `src/core/supabase/pagination.ts` (re-exportadas desde loaders para compatibilidad).

---

## Optimizaciones implementadas

### 1. Atenciones (`/atenciones`)

**Antes:** fetch ilimitado de turnos `attended` en el período (riesgo alto en vista mensual).

**Después:**
- Resumen (totales, modalidad, coberturas) vía RPC `summarize_attended_appointments` — sin traer filas.
- Detalle paginado: **50/página** con `?page=` (offset).
- UI: `ListPagination` en `PatientAttendanceRegister` (compatible: props opcionales).

**Archivos:** `load-atenciones-page.ts`, `atenciones/page.tsx`, `065_list_pagination_rpcs.sql`

### 2. Planillas PAMI (`/pami/planillas`)

**Antes:** todos los pacientes activos sin límite.

**Después:**
- Filtro PAMI (`insurance_provider ILIKE %PAMI%`).
- Paginación **50/página** + búsqueda `?q=`.
- Combobox remoto (`PatientSearchCombobox searchMode="remote"`) para selección sin cargar lista completa.

**Archivos:** `load-pami-planillas-page.ts`, `pami-planillas-view.tsx`, API pacientes extendida

### 3. Reporte mensual (`loadMonthlyClinicReport`)

**Antes:** fetch de **todas** las filas de `clinical_records` del mes para contar por profesional.

**Después:** RPC `count_clinical_records_by_professional` (GROUP BY en SQL).

### 4. Pickers de pacientes (caja, pagos, agenda)

**Antes:** `.limit(200–500)` sin paginación real.

**Después:**
- Helper compartido `loadPatientPickerList` con límite **80** (`PATIENT_PICKER_INITIAL_LIMIT`).
- Combobox existente filtra localmente (máx. 12 visibles) o busca vía API en modo `remote`.
- Caja/pagos migrados al helper.

### 5. Agenda

**Antes:** turnos en ventana −7d/+30d sin tope.

**Después:** `.limit(1000)` (`APPOINTMENTS_AGENDA_MAX`) — ventana temporal + tope de seguridad.
Pacientes picker: **80** iniciales (combobox con búsqueda local/API en formularios).

### 6. Workspace paciente — adjuntos

**Antes:** `patient_attachments` sin límite.

**Después:** `.limit(200)` (`PATIENT_ATTACHMENTS_LIMIT`) en workspace y EHR loader.

### 7. API `/api/command-palette/patients`

**Extendida:** parámetros `cobertura=pami`, `limit` (1–50), `extended=1` (campos extra para planillas).

---

## Consultas con límite aceptable (sin cambio)

| Consulta | Límite | Motivo |
|----------|--------|--------|
| Recetas recientes | 30 | Widget “recientes” |
| Dashboard ops widgets | 8 | Panel operativo |
| Recordatorios / telemedicina | 20 | Vista acotada |
| Pharmacology RPCs | 12 | Typeahead |
| Sala de espera (hoy) | día actual | Volumen acotado por diseño |
| Metadatos clínica (cache) | baja cardinalidad | Profesionales, sedes, etc. |

---

## Pendiente / siguiente iteración

| Área | Recomendación |
|------|---------------|
| EHR workspace (`PATIENT_EHR_RECORD_LIMIT=2000`) | Cursor + “cargar más” en timeline |
| `/historias/nueva` picker | Modo remote en combobox (actualmente 500 vía helper) |
| `/caja/reportes` charges | Offset si rango > 500 |
| `/datos` migración | Batch por offset (jobs existentes) |

Helpers de cursor ya disponibles en `pagination.ts` para implementación futura.

---

## Archivos nuevos / modificados

```
src/core/supabase/pagination.ts
src/core/hooks/use-async-patient-search.ts
src/lib/server/load-patient-picker-list.ts
src/features/administracion/server/load-atenciones-page.ts
src/features/pami/server/load-pami-planillas-page.ts
supabase/migrations/065_list_pagination_rpcs.sql
tests/pagination.test.ts
docs/PAGINATION_AUDIT.md
```

---

## Compatibilidad UI

- Pacientes e historias: sin cambios visibles.
- Atenciones: paginación solo aparece si hay >1 página.
- PAMI: búsqueda + paginación añadidas; combobox remoto sustituye select largo.
- Pickers caja/pagos: mismo UX; menos datos en memoria (80 vs 500).
- Agenda: sin cambio visual salvo clínicas con >1000 turnos en 37 días (caso extremo).
