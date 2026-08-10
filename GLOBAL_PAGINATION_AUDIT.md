# Global Pagination Audit — PROMPT 07

**Date:** 2026-08-10  
**Branch:** `feat/patient-search-optimization`

## Summary

Server-side pagination extended to high-traffic listados that previously loaded unbounded or large fixed slices. Existing paginated screens (pacientes, historias tab, atenciones, PAMI planillas) were verified and left unchanged.

## Already paginated (no change)

| Screen | Mechanism | Page size |
|--------|-----------|-----------|
| `/pacientes` | offset + `count: exact` | 20 |
| `/pacientes?seccion=historias` | offset | 25 |
| `/atenciones` | offset + RPC summary | 50 |
| `/pami/planillas` | offset + remote search | 50 |

## Implemented in PROMPT 07

| Screen | Before | After |
|--------|--------|-------|
| `/turnos/lista-espera` | All `active`/`contacted` rows | offset 25 + search by patient + prev/next |
| `/pagos` | `.limit(50)` hidden cap | offset 30 + UI pagination + remote patient picker |
| `/caja/reportes` | `.limit(500)` + JS totals | offset 50 + RPC period totals + pagination |
| Patient workspace → Auditoría | Fixed 120×2 merge | Cursor “Cargar más” (40/page) |
| `/historias/nueva` | `loadPatientPickerList(500)` | `PatientSearchCombobox` remote |

### New constants (`src/core/supabase/pagination.ts`)

- `WAITING_LIST_PAGE_SIZE = 25`
- `PAYMENTS_PAGE_SIZE = 30`
- `CAJA_REPORTES_PAGE_SIZE = 50`
- `PATIENT_AUDIT_PAGE_SIZE = 40`

### New loaders

- `src/features/turnos/server/load-waiting-list-page.ts`
- `src/features/facturacion/server/load-pagos-page.ts`
- `src/features/facturacion/server/load-caja-reportes-page.ts`

## Performance model (simulated)

Tests in `tests/performance/global-pagination.test.ts` compare one-page fetch vs loading all rows:

| Total rows | Lista espera (25/page) | Caja reportes (50/page) |
|------------|------------------------|-------------------------|
| 1,000 | 25 fetched vs 1,000 | 50 vs 500 (old cap) |
| 10,000 | 25 vs 10,000 | 50 vs 500 |
| 100,000 | 25 vs 100,000 | 50 vs 500 (2000 pages) |

Period totals on caja reportes use existing RPC `sum_collected_cash_charges` so aggregates stay accurate without scanning the table in the browser.

## Remaining gaps (follow-up)

| Area | Issue | Suggested fix |
|------|-------|---------------|
| EHR workspace timeline | `PATIENT_EHR_RECORD_LIMIT = 2000` | Cursor load-more on clinical records |
| `/caja/cierre` | All day charges in memory | RPC totals + paginated detail |
| `/caja/cuenta-corriente` | patients 200 / ledger 100 caps | offset pagination |
| Turnos reportes config | 30-day appointments fetch-all | RPC aggregate or date paging |
| Admin global audit | N/A (per-patient only) | — |

## UI checklist (implemented screens)

- [x] Loading states (audit panel, waiting-list status updates)
- [x] Anterior / Siguiente
- [x] Result count labels
- [x] Search / filters preserved in URL
- [x] Server-side pagination (Supabase `.range()` or cursor)
