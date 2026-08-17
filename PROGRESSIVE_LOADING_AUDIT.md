# Progressive Loading Audit — PROMPT 08

**Date:** 2026-08-10

## Principles

- Skeletons align with **real** Suspense boundaries or in-flight navigations — not masks over slow monolithic loaders.
- Prefer **fewer queries** and **smaller payloads** before cosmetic loading UI.

## Implemented

### Dashboard (`/dashboard`)

| Change | Real impact |
|--------|-------------|
| Split loader: `loadClinicalOperationsDashboardCore` + `Secondary` | Core: 2 appointment queries + allergies. Secondary: 4 widgets deferred. |
| Header renders before ops data | Shell visible immediately after auth |
| `Suspense` + `ClinicalOpsSecondarySkeleton` | Below-fold widgets stream after core paint |
| `observeQuery` tags: `load_clinical_operations_dashboard_core` / `_secondary` | Measurable in observability |

### Pacientes (`/pacientes`)

| Change | Real impact |
|--------|-------------|
| `getDashboardPageContext()` | Deduped auth vs 4 sequential calls |
| Parallel `batchPatientConsultationCounts` + share log | −1 sequential round-trip |
| `PacientesListPanel` + `PacientesListSkeleton` on `isNavigating` | Search form stays interactive during transition |

### Turnos (`/turnos/agenda`)

| Change | Real impact |
|--------|-------------|
| SSR window: week −7d → week +14d (~21d vs 37d) | Fewer appointment rows fetched |
| `turnos/agenda/loading.tsx` | Route-level shell during navigation |

### Historia clínica (`/pacientes/[id]`)

| Change | Real impact |
|--------|-------------|
| `getWorkspaceFetchPlan(tab)` | Tab-scoped queries — e.g. auditoría skips 6+ EHR queries |
| `loadPatientWorkspacePageData(..., activeTab)` | First paint **20** evolutions; recetas/órdenes skip records |

### PAMI (`/pami/planillas`)

| Status | Notes |
|--------|-------|
| Already strong | Route `loading.tsx` + in-page search skeletons (reference impl.) |

### Lista de espera

| Change | Real impact |
|--------|-------------|
| `turnos/lista-espera/loading.tsx` | Route shell during navigation (PROMPT 07 pagination already server-side) |

## Measurement

`observeQuery` spans (existing):

- `load_clinical_operations_dashboard_core`
- `load_clinical_operations_dashboard_secondary`
- `load_pacientes_page`
- `load_clinical_operations_dashboard` (legacy full loader — still available)

Compare p50/p95 before/after in logs or Datadog for TTFB and query duration.

## Tests

- `tests/performance/progressive-loading.test.ts` — fetch plan + loader split smoke tests

## Follow-up

- Agenda: client fetch when user navigates beyond ±3 week window
- Dashboard: stream left-rail task counts when secondary resolves
- Historias list: search transition skeleton (mirror pacientes)
