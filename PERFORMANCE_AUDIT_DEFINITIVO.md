# DrFlow — Auditoría de Performance Definitiva

**Fecha:** 2026-08-10  
**Alcance:** Frontend, Backend, Database, UX — módulos Dashboard, Pacientes, Turnos, Historia Clínica, PAMI, Obras Sociales, Profesionales, Facturación  
**Baseline:** Migraciones 087–090 aplicadas; PROMPT 07–09 (paginación global, progressive loading, RLS hardening)

---

## Resumen ejecutivo

DrFlow ya tiene bases sólidas (paginación en listados clave, RPC de búsqueda 087, índices 088–089, RLS 090, progressive loading en dashboard). Los cuellos de botella restantes que impiden escala a **100k+ pacientes / 1M+ turnos** se concentran en:

1. Conteos pesados en listado de pacientes (scan + Storage HCE)
2. EHR workspace con hasta 2000 registros clínicos sin cursor
3. Búsqueda de pacientes dual (RPC vs PostgREST ILIKE)
4. Caja cierre / reportes turnos sin agregación SQL
5. Client islands monolíticos (agenda, wizard, shell ~1.2 MB)

---

## Informe de hallazgos

| Problema | Severidad | Impacto | Archivo | Solución |
| -------- | --------- | ------- | ------- | -------- |
| Listado pacientes usa `batchPatientConsultationCounts` (scan clinical_records + N downloads Storage HCE) por cada página | **CRÍTICO** | 20 pacientes → cientos de filas clínicas + hasta 20 lecturas Storage; TTFB alto en `/pacientes` | `src/lib/utils/batch-patient-record-counts.ts`, `load-pacientes-page.ts` | Usar RPC `count_clinical_records_by_patients` (como historias tab) |
| EHR carga hasta 2000 `clinical_records` sin cursor | **CRÍTICO** | Payload masivo en ficha paciente; memoria/hydration lentos | `load-patient-ehr-data.ts`, `patient-workspace-fetch-plan.ts` | Cursor pagination 50–100 + "Cargar más" |
| Cambio de tab en ficha = full RSC reload (~10 queries) | **CRÍTICO** | Latencia alta SOAP ↔ recetas ↔ timeline | `use-patient-workspace-tab.ts`, `load-patient-workspace-page.ts` | Parallel routes / prefetch tabs / fetch por tab sin router.push |
| Turnos reportes: fetch-all 30 días de appointments | **CRÍTICO** | O(n) turnos en memoria para métricas JS | `load-turnos-config-page.ts` | RPC agregados por status/profesional/fecha |
| Caja cierre: scan completo de cargos del día sin cierre guardado | **CRÍTICO** | O(cargos/día) en clínicas de alto volumen | `caja/cierre/page.tsx` | RPC `summarize_collected_cash_charges_for_closure` |
| Búsqueda listados usa PostgREST ILIKE en vez de RPC 087 | **ALTO** | No usa índices DNI/teléfono; `.or()` multi-token degrada con escala | `patient-search.ts`, `load-pacientes-page.ts`, `load-pami-planillas-page.ts`, `load-waiting-list-page.ts` | Unificar en `search_patients_for_clinic` + count/offset |
| Dashboard shell cliente ~1.2 MB first-load JS | **ALTO** | TTI elevado en todas las rutas autenticadas | `dashboard-data-shell.tsx`, ~200 `"use client"` | Lazy islands, React Compiler, reducir providers |
| `AgendaView` monolítico client (~1023 KB route) | **ALTO** | Sin streaming; re-render grid completo | `agenda-view.tsx`, `turnos/agenda/page.tsx` | Header RSC, dynamic dialogs, fetch incremental semanas |
| `TurnosNuevoWizard` ~1032 LOC client | **ALTO** | Bundle pesado `/turnos/nuevo` | `turnos-nuevo-wizard.tsx` | Steps lazy con `dynamic()` |
| `router.refresh()` poll 30s dashboard + sala espera | **ALTO** | Recarga RSC layout+page en background | `clinical-ops-realtime.tsx`, `waiting-room-view.tsx` | Delta via channel; refresh solo post-mutación |
| `/caja` usa `loadPatientPickerList(80)` + filtro client | **ALTO** | Query + payload; pacientes fuera del top-80 invisibles | `caja/page.tsx`, `load-patient-picker-list.ts` | `PatientSearchCombobox` remoto |
| Config carga todas las secciones en cada visita | **ALTO** | TTFB alto en tab coberturas u otras livianas | `configuracion/page.tsx` | Loaders por sección + Suspense |
| Ingreso profesionales: roster + reglas + members unbounded | **ALTO** | Escala mal con clínicas grandes | `ingreso-profesionales/page.tsx` | Paginar sidebar; detalle bajo demanda |
| Agenda SSR ±21d; navegación fuera de rango sin fetch | **ALTO** | Calendario vacío al cambiar semana lejana | `turnos/agenda/page.tsx`, `use-agenda-view.ts` | Server Action al cruzar umbral |
| `loadRevenueSnapshot` duplica lectura cargos en `/caja` | **ALTO** | Hasta 3000 filas + list query 50 | `caja/page.tsx`, `load-revenue-snapshot.ts` | RPC compartido; una fuente de verdad |
| Cuenta corriente: 200 pacientes + 100 movimientos fijos | **ALTO** | Truncamiento oculto | `caja/cuenta-corriente/page.tsx` | Remote search + cursor ledger |
| Historias: árbol EHR ~100% client + refresh post-mutación | **MEDIO** | Bundle `/pacientes/[id]` ~1120 KB | `patient-soap-workspace.tsx`, `patient-ehr-interactive-body.tsx` | SSR listas; client solo editor activo |
| Historias listado sin skeleton de búsqueda | **MEDIO** | UI congelada en GET search | `clinical-historias-list-panel.tsx` | Patrón `PacientesListPanel` + useTransition |
| Dashboard hoy: appointments sin límite | **MEDIO** | 50–200+ filas + joins en clínicas activas | `load-clinical-operations-dashboard-core.ts` | Cap razonable o RPC cola vs stats |
| Agenda hard cap 1000 appointments | **MEDIO** | Truncamiento silencioso | `pagination.ts` `APPOINTMENTS_AGENDA_MAX` | Fetch por ventana de fecha |
| PAMI RLS nested EXISTS (079) | **MEDIO** | Subquery extra por evaluación RLS | migración 079 | Denormalizar `clinic_id` en tablas hijas |
| Auth shell: 4 calls vs `getDashboardPageContext()` | **MEDIO** | Ruido; mitigado por React.cache | múltiples pages | Unificar shell helper |
| `RoutePrefetcher` 15 rutas en idle | **MEDIO** | Compite con navegación real | `route-prefetcher.tsx` | Prefetch por rol/hover |
| Missing `loading.tsx` en rutas calientes | **MEDIO** | Sin feedback percibido | pacientes, caja, pagos, ficha | Shells por módulo |
| PAMI planillas: referencia (paginación 50, skeletons) | **BAJO** | — | `pami/planillas/` | Template para otros listados |
| Pacientes listado: paginación 20 + debounce | **BAJO** | — | `pacientes/page.tsx` | Mantener |
| Validación Zod en Server Actions | **BAJO** | Sub-ms; no bottleneck | `core/validations/` | Sin cambio |
| Obras sociales: settings-only | **BAJO** | 1 SELECT + UPDATE | `coverages.ts` | OK |

---

## Plan de remediación (orden de impacto)

### Grupo 1 — DB hot paths (este PR)
- [x] Informe audit
- [x] RPC counts en `/pacientes` (eliminar scan HCE)
- [x] Migración 091: search paginado + cierre caja RPC
- [x] Unificar búsqueda pacientes en listados
- [x] Tests + typecheck + lint + build

### Grupo 1 — Cambios aplicados

| Archivo | Cambio |
| ------- | ------ |
| `load-pacientes-page.ts` | `batchPatientRecordCounts` (RPC) + búsqueda vía RPC 091 |
| `load-pami-planillas-page.ts` | Búsqueda PAMI vía RPC paginado |
| `load-waiting-list-page.ts` | Filtro pacientes vía `findPatientIdsByTextSearch` |
| `load-cash-closure-day-totals.ts` | Agregación RPC cierre con fallback |
| `091_performance_audit_group1.sql` | offset search + count + closure summary RPC |

### Grupo 2 — Paginación faltante (aplicado)
- [x] EHR cursor pagination (80 inicial + "Cargar más consultas")
- [x] Turnos reportes RPC agregados (092)
- [x] Cuenta corriente: remote search + ledger 50/página
- [x] Tests + typecheck + lint + build

**Deploy requerido:** migración **092** en Supabase.

### Grupo 2 — Cambios aplicados

| Archivo | Cambio |
| ------- | ------ |
| `load-patient-ehr-data.ts` | Límite 80; paginación clínica |
| `load-more-patient-clinical-records.ts` | Server action cursor |
| `patient-ehr-sidebar.tsx` | Botón "Cargar más" |
| `load-turnos-config-page.ts` | RPC `summarize_appointments_for_turnos_reportes` |
| `092_performance_audit_group2.sql` | Agregación SQL turnos |
| `load-cuenta-corriente-page.ts` + `cuenta-corriente-view.tsx` | Remote picker + paginación |

### Grupo 3 — Frontend / UX (aplicado)
- [x] Caja remote patient picker (`PatientSearchCombobox`, sin `loadPatientPickerList`)
- [x] Agenda split RSC + dynamic dialogs (`Header` en page, `dynamic()` dialogs)
- [x] Config loaders por sección (`load-configuracion-section-extras.ts`)
- [x] Reemplazar poll+refresh 30s (realtime + debounce sala espera)
- [x] `loading.tsx` rutas calientes (`pacientes`, `caja`, `pagos`, `pacientes/[id]`)

### Grupo 4 — Arquitectura ficha paciente (aplicado)
- [x] Tab navigation sin full RSC reload (`replaceState` + `loadPatientWorkspaceTabPanel`)
- [x] Bundle shell reduction (prefetch acotado por rol)
- [x] Ingreso profesionales: sidebar liviano + detalle bajo demanda

### Grupo 4 — Cambios aplicados

| Archivo | Cambio |
| ------- | ------ |
| `patient-workspace-shell.tsx` | Client shell con cache por tab + lazy server action |
| `load-patient-workspace-tab-panel.ts` | Fetch tab-scoped sin navegación RSC |
| `use-patient-workspace-tab.ts` | `history.replaceState` en lugar de `router.push` |
| `load-professional-intake-page-data.ts` | Sidebar liviano + detalle/reglas del seleccionado |
| `load-professional-intake-detail-panel.ts` | Server action al cambiar profesional |
| `route-prefetcher.tsx` | 5–7 rutas core según rol (antes 15 fijas) |

---

## PERFORMANCE BEFORE / AFTER

### Grupo 1 (aplicado)

| Métrica | Before | After |
| ------- | ------ | ----- |
| `/pacientes` conteos (20 rows) | Scan `clinical_records` + N× Storage HCE | 1× RPC `count_clinical_records_by_patients` |
| `/pacientes` búsqueda | PostgREST ILIKE multi-token | RPC 087 + `count_patients_for_clinic_search` (091) |
| PAMI planillas búsqueda | PostgREST ILIKE | RPC paginado `p_pami_only=true` |
| Lista espera búsqueda | ILIKE + limit 500 PostgREST | RPC search IDs (hasta 500) |
| Caja cierre (sin closure) | Fetch all `cash_charges` del día | 1× RPC JSON aggregation |
| Queries `/pacientes` (search) | ~4–6 + scan records | ~4–5 + 1 RPC count |

**Deploy requerido:** migración **091** en Supabase.

### Grupo 2 (aplicado)

| Métrica | Before | After |
| ------- | ------ | ----- |
| Apertura ficha paciente / EHR | Hasta 2000 records | 80 inicial + "Cargar más consultas" |
| Turnos reportes | Fetch-all 30 días | RPC `summarize_appointments_for_turnos_reportes` |
| Cuenta corriente | 200 pacientes `<select>` + 100 movimientos | Remote search + 50/página |

**Deploy requerido:** migración **092** en Supabase.

### Grupo 3 (aplicado)

| Métrica | Before | After |
| ------- | ------ | ----- |
| Caja alta de cargo | `loadPatientPickerList` (200 pacientes) | `PatientSearchCombobox` remoto |
| Agenda bundle inicial | Header + 3 dialogs en chunk principal | Header RSC; dialogs `dynamic()` |
| Configuración | 5+ fetches en cada visita | Extras solo para sección activa |
| Dashboard / sala espera | `setInterval` 30s + `router.refresh` | Solo realtime (+ debounce 1.5s) |
| Rutas calientes | Sin skeleton | `PageSkeleton` en pacientes/caja/pagos/ficha |

**Deploy requerido:** solo frontend (sin migración).

**Deploy requerido:** solo frontend (sin migración).

### Grupo 4 (aplicado)

| Métrica | Before | After |
| ------- | ------ | ----- |
| Cambio tab ficha paciente | Full RSC reload (~10 queries) | Client tab + 1 server action tab-scoped |
| Prefetch dashboard idle | 15 rutas fijas | 5–7 rutas según rol |
| Ingreso profesionales | Roster + reglas + detalle full de todos | Sidebar liviano; detalle/reglas del seleccionado |

**Deploy requerido:** solo frontend (sin migración).
