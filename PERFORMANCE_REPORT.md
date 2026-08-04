# Performance Report — Enterprise Stabilization

**Date:** 2026-07-30  
**Gate:** `npm run performance:gate` ✅

---

## 1. Before / after (stabilization changes)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Largest component | 217 lines | 212 lines | −5 (palette refactor) |
| Components ≥250 lines | 0 | 0 | — |
| Command palette provider bundle concern | Monolithic 217-line module | Split hooks | Better tree-shaking potential |
| Dashboard SSR queries | Parallel fetch | Parallel fetch | No regression |
| Patient workspace loader | Single parallel fetch | Unchanged | No N+1 added |

---

## 2. Critical path analysis

| Path | Strategy | Target |
|------|----------|--------|
| `/dashboard` | Parallel Supabase in `loadClinicalOperationsDashboard` | <2s TTFB |
| `/pacientes/[id]` | `loadPatientWorkspacePageData` single Promise.all | <2s |
| Command palette search | Debounced 200ms fetch | Non-blocking |
| Realtime (dashboard) | Supabase channel + 30s poll fallback | Live queue |

---

## 3. Render optimization (existing)

- `PatientChartView` / workspace panels: `dynamic()` + Suspense skeletons
- Clinical ops AI rail: lazy `next/dynamic`
- Dashboard secondary widgets: deferred client load

---

## 4. Waterfalls avoided

- Server Components for page shells
- Loaders colocated in `lib/server/` — no client-side fetch for initial data
- No sequential awaits in dashboard/patient loaders

---

## 5. Recommendations

1. Add RUM for LCP on `/dashboard` and `/pacientes/[id]`
2. Profile `loadPatientWorkspacePageData` with >2000 clinical records
3. Consider `React.cache` dedup for shared layout fetches (already partial via session cache)
4. Bundle analyze pharmacology routes (largest feature modules)

---

*Benchmark tests: 4 passed · 292 components measured*
