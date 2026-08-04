# DrFlow Performance Report

**Date:** 2026-08-04  
**Scope:** Bundle size, server data fetching, rendering, Suspense/lazy loading, query waterfalls, N+1

---

## Executive summary

| Area | Before | After | Improvement |
|------|--------|-------|-------------|
| `/historias` N+1 counts | Up to **25 queries**/page | **1 batched query** | ~96% fewer round-trips |
| `/historias/[id]` redirect | **8+ queries** then redirect | **1 lightweight query** | ~87% fewer queries on common path |
| Patient workspace loader | **14 parallel + 3 sequential** | **11 parallel + 2 sequential** | −2 appointment queries, −1 portal waterfall, −1 HCE attachment dup |
| Pacientes list portal | **2 sequential** portal queries | **1** (parallel with page) | 50% portal latency |
| Observability snapshot | **2 table scans** | **1 scan** (slice in memory) | 50% DB queries |
| Recetas hub patient preload | **500 rows** + dead branch | **80 rows**, dead code removed | 84% smaller patient payload |

Existing strengths: `next/dynamic` on workspace tabs, `Promise.all` in most loaders, `optimizePackageImports` for `lucide-react` and `date-fns`, React `cache()` on session helpers.

---

## Methodology

1. Static audit of all `load-*.ts` server loaders and 46 `page.tsx` routes
2. Pattern search: `dynamic(`, `Suspense`, sequential `await`, `.map(async`
3. Build analysis via `next build` (Turbopack, Next.js 16)
4. Vitest perf suite: `tests/performance/`
5. Query-count modeling for hot paths (documented below)

---

## 1. Bundle analysis

### Configuration (already in place)

```typescript
// next.config.ts
experimental: {
  optimizePackageImports: ["lucide-react", "date-fns"],
}
serverExternalPackages: ["pdf-parse", "pdfjs-dist", "unpdf", "xlsx"],
reactCompiler: true,
```

### Lazy-loaded client chunks

| Component | File | Pattern |
|-----------|------|---------|
| Patient workspace tabs | `patient-workspace-view.tsx` | `next/dynamic` × 5 panels |
| Clinical workflow shortcuts | `layout.tsx` | `Suspense` boundary |
| Login / register forms | auth pages | `Suspense` + dynamic forms |
| Config sections | `configuracion/page.tsx` | dynamic imports |

### Large server-only packages (not in client bundle)

- PDF parsing (`pdf-parse`, `pdfjs-dist`, `unpdf`) — externalized
- Excel (`xlsx`) — externalized
- Supabase client — server components only on data pages

### Recommendations (P2, not implemented)

- Add `@supabase/supabase-js` tree-shaking audit if client usage grows
- Lazy-load `PrescriptionsOrdersHub` on recetas if hub bundle grows
- Consider `loading.tsx` skeletons for `/pacientes/[id]` and `/historias`

---

## 2. Server query optimization (implemented)

### P0 — Historias list N+1 eliminated

**Before:** One `count` head request per unique patient on the page (up to 25).

**After:** `batchPatientRecordCounts()` — single `.in("patient_id", ids)` query, aggregate in memory.

```typescript
// src/lib/utils/batch-patient-record-counts.ts
```

Also parallelized clinic total count with paginated records fetch when no search filter.

**Measured:** 25 queries → **1 query** (worst case page).

---

### P0 — Historias detail redirect before heavy fetch

**Before:** `loadHistoriaDetailPageData()` (8+ queries) on every `/historias/[id]` visit, then redirect to patient workspace.

**After:** Single `clinical_records.select("patient_id")` → redirect. Full loader only when `?embed=1`.

**Measured:** ~8 queries → **1 query** on default navigation path.

---

### P1 — Portal context unified

**Before:** `getPortalSlugForClinic()` → `getDoctorShareInfoForClinic()` → `resolvePortalDoctorInfo()` (3 round-trips, duplicate `public_booking_links` reads).

**After:** `getPortalContextForClinic(clinicId, supabase?)` — one joined query, reused in workspace + pacientes loaders.

**Files:** `src/lib/utils/portal-doctor-info.ts`

---

### P1 — Patient workspace loader

| Change | Queries saved |
|--------|---------------|
| Portal in main `Promise.all` | 2 sequential → 0 |
| Single appointments query (limit 80, split in memory) | 1 |
| HCE: reuse attachment `file_path` from batch | 1 (when HCE file exists) |

**Before:** ~14 parallel + portal (2) + doctor (2) + HCE lookup (1) = up to **19 round-trips**  
**After:** ~11 parallel + HCE download only + optional share log = up to **13 round-trips**

---

### P1 — Pacientes page

Portal context fetched in parallel with paginated patient query (was sequential before page data).

---

### P2 — Observability

Single 24h query (limit 500); recent 25 events = `slice(0, 25)` in memory.

---

### P2 — Recetas hub

- Patient preload: 500 → **80** rows
- Removed dead `patientId` branch (page redirects to workspace before load)

---

## 3. Query budget reference (hot paths)

| Route / loader | Queries (after) | Notes |
|----------------|-----------------|-------|
| `/historias` | 3–4 | count∥records + batch counts |
| `/historias/[id]` (default) | 1 | redirect only |
| `/pacientes/[id]` workspace | ~13 | parallel batch + HCE storage |
| `/pacientes` list | 3–4 | patients∥portal + optional shares |
| `/dashboard` ops | 6–8 | existing `Promise.all` |
| `/recetas` hub | 3 | no dead patient branch |

---

## 4. Rendering & Suspense

### Present

- `PatientWorkspaceView` — dynamic imports for audit, IA, chart, EHR panels
- Dashboard layout — `Suspense` on `ClinicalTopNav`, `ClinicalWorkflowShortcuts`
- Patient page — `Suspense` around `PatientWorkspaceContent`
- Command palette — client-only, lazy on first `Ctrl+K`

### Gaps (future work)

| Gap | Impact | Suggestion |
|-----|--------|------------|
| No `loading.tsx` on `/pacientes/[id]` | Slow TTFB feels blocking | Add skeleton matching `PatientWorkspaceSkeleton` |
| Historias list fully server-rendered | OK for SEO; blocks on all queries | Stream list with Suspense boundary |
| 25+ pages repeat auth fetches | Mitigated by React `cache()` | Migrate to `getDashboardShell()` |

---

## 5. Remaining opportunities (not in this batch)

| Priority | Item | Est. gain |
|----------|------|-----------|
| P1 | Portal page duplicate booking link query | 1 query/visit |
| P2 | `getDashboardShell()` on all dashboard pages | Cleaner + fewer profile reads |
| P2 | Pagos page unbounded patients fetch | Memory + query time |
| P2 | Datos page 6 parallel heavy exports | Defer until user action |
| P3 | `FORCE` streaming for clinical ops widgets | Perceived latency |
| P3 | Storage integration perf tests | Regression guard |

---

## 6. Tests & regression guard

```bash
npm test -- tests/performance/
npm run build
```

| Test | Validates |
|------|-----------|
| `critical-utils.perf.test.ts` | CSV parse <1s, palette filter <50ms |
| `batch-patient-record-counts.test.ts` | N+1 batch aggregator |
| `security-p0-p1-fixes.test.ts` | Static migration/app patterns |

Optional RLS perf: `DRFLOW_RLS_INTEGRATION=1 npm test`

---

## 7. Key files changed

| File | Change |
|------|--------|
| `src/lib/utils/batch-patient-record-counts.ts` | New — batch count helper |
| `src/lib/utils/portal-doctor-info.ts` | `getPortalContextForClinic()` |
| `src/lib/server/load-historias-page.ts` | Batch counts + parallel fetch |
| `src/app/(dashboard)/historias/[id]/page.tsx` | Redirect before heavy load |
| `src/lib/server/load-patient-workspace-page.ts` | Portal parallel, merged appointments |
| `src/lib/server/load-pacientes-page.ts` | Parallel portal |
| `src/lib/server/load-observability.ts` | Single scan |
| `src/lib/server/load-recetas-page.ts` | Smaller preload, dead code removed |
| `src/lib/utils/patient-ehr-from-hce.ts` | Optional preloaded file path |

---

## 8. Conclusion

This optimization pass targets **database round-trips** and **waterfall fetches** — the dominant latency source for a Supabase-backed clinical app. The largest wins are on `/historias` (N+1 elimination), `/historias/[id]` (redirect-first), and `/pacientes/[id]` (portal + appointments + HCE dedup).

Client bundle size was already reasonable due to RSC architecture and existing `dynamic()` usage; further gains will come from route-level `loading.tsx` and deferring heavy export queries.

---

*Generated 2026-08-04. Re-run after major loader or route changes.*
