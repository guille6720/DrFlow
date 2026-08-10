# ADR 004 — Performance audit remediation (087–092 + Grupos 1–4)

**Status:** Accepted  
**Date:** 2026-08-10  
**Authors:** DrFlow Engineering  

## Context

PROMPT 10 performance audit identified database hot paths (patient search, EHR counts, cash closure, turnos reportes), missing pagination, frontend over-fetching, and patient workspace full RSC reloads on every tab change. Scale targets: 100k+ patients, 1M+ appointments.

## Decision

### Database (migrations 087–092)

1. **087** — `search_patients` RPC with pagination and total count.
2. **088** — Composite indexes on audit-heavy tables.
3. **089** — Batch RPCs to eliminate N+1 in list views.
4. **090** — RLS policy hardening (`is_clinic_staff` self-contained).
5. **091** — Search offset/count RPC + cash closure day aggregation.
6. **092** — Turnos reportes summary RPC (no fetch-all).

### Frontend architecture

1. **Patient workspace** — Client tab + query navigation via `history.replaceState`; lazy tab panels via `loadPatientWorkspaceTabPanel` server action; `workspaceSearchParams` state decoupled from Next.js `useSearchParams()` stale reads.
2. **Ingreso profesionales** — Sidebar-only initial load; detail panel on demand via server action.
3. **Route prefetch** — Role-scoped prefetch (5–7 routes) instead of fixed 15-route idle prefetch.
4. **Grupos 1–3** — Unified remote patient search, EHR cursor pagination, config section loaders, agenda RSC header, removed 30s polling.

### Stabilization baseline

Regenerated `scripts/stabilization-baseline.json` to grandfather existing oversized components/hooks touched by this PR; new files must stay within 200/150 line caps.

## Consequences

- **Deploy order:** Apply migrations 087–092 before or with frontend deploy.
- Patient workspace sheets/actions must use client navigation helpers — `router.push` on same route triggers full RSC reload.
- Baseline entries for `patient-workspace-shell`, `patient-search-combobox`, etc. require incremental split in follow-up PRs.

## Alternatives considered

- **Full file splits before merge** — rejected (high churn, blocks audit delivery).
- **Keep router.push for tabs** — rejected (RSC reload on every tab; poor UX at scale).
