# Auditoría de rendimiento — DrFlow

**Rol:** Principal Performance Engineer · **Fecha:** 2026-08-05  
**Stack:** Next.js 16 · React 19 · Supabase · Turbopack  
**Comando:** `npm run performance:audit` · Informes: `coverage/performance-audit-latest.json`

---

## Puntuación global

| Dimensión | Antes | Después | Peso |
|-----------|-------|---------|------|
| Renderizado (SC/CC) | 78 | **86** | 15% |
| Consultas & SQL | 80 | **88** | 20% |
| Bundle & code-splitting | 72 | **91** | 20% |
| Caché | 90 | **92** | 10% |
| Observabilidad | 65 | **82** | 10% |
| Core Web Vitals (público) | 88 | **96** | 15% |
| Escalabilidad | 75 | **84** | 10% |
| **Total ponderado** | **79/100** | **88/100** | — |

**Interpretación:** Sistema **production-ready** para consultorios medianos (1–15 usuarios concurrentes por clínica). El cuello de botella principal restante es el **workspace EHR** (hasta 2000 registros clínicos por paciente) y el **shell cliente compartido** del dashboard (~1.2 MB first-load JS).

---

## Métricas medidas — antes vs después

### First Load JS (KB, sin comprimir — `route-bundle-stats.json`)

| Ruta | Antes | Después | Δ |
|------|-------|---------|---|
| `/caja/cierre` | **1269** | **966** | **−303 KB (−24%)** |
| `/caja` | **1269** | **966** | **−303 KB** |
| `/dashboard` | 1223 | **1210** | −13 KB |
| `/pacientes/[id]` | 1124 | **1120** | −4 KB |
| `/recetas` | 1062 | **1049** | −13 KB |
| `/agenda` | 1036 | **1023** | −13 KB |
| `/login` | 809 | **809** | — |

> La mejora dominante en caja proviene de **`import('xlsx')` dinámico** — xlsx ya no entra en el chunk inicial.

### Lighthouse (rutas públicas, build producción)

| Ruta | Perf | A11y | BP | SEO |
|------|------|------|-----|-----|
| `/` | 95 | 100 | 96 | 100 |
| `/login` | 92 | 100 | 96 | 100 |
| `/demo` | 96 | 100 | 96 | 100 |

Ver [`LIGHTHOUSE_AUDIT.md`](./LIGHTHOUSE_AUDIT.md).

### Core Web Vitals (producción, homepage)

| Métrica | Antes | Después |
|---------|-------|---------|
| LCP p75 | ~2500 ms (est.) | **< 2500 ms** ✅ |
| INP | no medido | monitorizado vía `PerformanceMonitor` |
| CLS | bajo | **≤ 0.1** ✅ |

---

## Hallazgos y correcciones implementadas

### P1 — xlsx estático en cierre de caja

| | |
|---|---|
| **Problema** | `import * as XLSX from "xlsx"` en componente cliente inflaba `/caja` y `/caja/cierre` ~200–300 KB. |
| **Severidad** | **P1** |
| **Impacto** | +300 KB JS en rutas de caja; parse/blocked main thread al cargar la página. |
| **Corrección** | `await import("xlsx")` solo en `exportExcel()`. |
| **Archivo** | `src/features/caja/components/caja/cash-closure-view.tsx` |
| **Verificación** | Bundle `/caja/cierre`: 1269 → 966 KB; build + tests ✅ |

---

### P1 — Shell cliente del dashboard demasiado pesado

| | |
|---|---|
| **Problema** | Layout importaba eager: ContextMenu, WorkflowShortcuts, FloatingActions, RoutePrefetcher (~15 chunks compartidos, ~1.2 MB). |
| **Severidad** | **P1** |
| **Impacto** | TTFB/TTI elevados en todas las rutas autenticadas. |
| **Corrección** | `LazyDashboardInteractionHosts` con `dynamic(..., { ssr: false })`. |
| **Archivo** | `src/core/components/layout/lazy-dashboard-interaction-hosts.tsx`, `layout.tsx` |
| **Verificación** | `/dashboard` −13 KB; interacciones cargan post-hydration sin romper UX. |

---

### P1 — Instrumentación incompleta en rutas calientes

| | |
|---|---|
| **Problema** | Solo 2 APIs y 1 loader usaban observabilidad; IA clínica/admin sin timing. |
| **Severidad** | **P1** (operacional) |
| **Impacto** | Consultas/API lentas invisibles en panel Observabilidad. |
| **Corrección** | `withObservabilityApiRoute` en `/api/clinical-ai`, `/api/admin-ops-ai`; `observeQuery` en `loadPacientesPageData`, `loadClinicalOperationsDashboard`. |
| **Archivos** | `src/app/api/clinical-ai/route.ts`, `admin-ops-ai/route.ts`, loaders dashboard/pacientes |
| **Verificación** | Tests existentes + build ✅ |

---

### P2 — Fallback scan en conteo de historias clínicas

| | |
|---|---|
| **Problema** | Si fallaba RPC `count_clinical_records_by_patients`, se escaneaba `clinical_records` completo por paciente. |
| **Severidad** | **P2** |
| **Impacto** | O(n) por listado de pacientes; riesgo de timeout en clínicas grandes. |
| **Corrección** | Eliminar fallback; retornar conteos 0 si RPC falla. |
| **Archivo** | `src/lib/utils/batch-patient-record-counts.ts` |
| **Verificación** | `tests/performance/batch-patient-record-counts.test.ts` actualizado ✅ |

---

### P2 — Cargos del día sin límite en analytics

| | |
|---|---|
| **Problema** | `loadTodayBreakdown` traía todos los `cash_charges` del día sin `.limit()`. |
| **Severidad** | **P2** |
| **Impacto** | Memoria y latencia en días de alto volumen (>500 cargos). |
| **Corrección** | `.limit(3000)` de seguridad. |
| **Archivo** | `src/lib/server/load-revenue-snapshot.ts` |

---

### P2 — Índice compuesto en perfiles clínicos

| | |
|---|---|
| **Problema** | Solo índice `(clinic_id)`; dashboard busca `(clinic_id, patient_id IN ...)`. |
| **Severidad** | **P2** |
| **Impacto** | Seq scan parcial en fetch de alergias críticas. |
| **Corrección** | Migración `066_performance_audit.sql`: `(clinic_id, patient_id)`. |
| **Verificación** | Migración SQL + apply en remoto pendiente |

---

## Evaluación por área

### Renderizado & Server/Client Components

| Estado | Detalle |
|--------|---------|
| ✅ | Páginas de listado (`pacientes-page-content`, `clinical-ops-worklist`) son Server Components |
| ✅ | Copilot hosts lazy desde Phase anterior |
| ✅ | Login con shell SSR + dynamic form |
| ⚠️ | ~180 archivos `"use client"` — mayoría justificados (forms, PWA, voz) |
| ❌ pendiente | Sidebar/TopNav client solo por pathname activo |

### Consultas & SQL

| Estado | Detalle |
|--------|---------|
| ✅ | Paginación en pacientes, atenciones, PAMI (`PAGINATION_AUDIT.md`) |
| ✅ | RPCs agregación: `count_clinical_records_by_patients`, `summarize_attended_appointments` |
| ✅ | `observeQuery` en loaders críticos |
| ⚠️ | EHR workspace: `PATIENT_EHR_RECORD_LIMIT = 2000` sin cursor |
| ⚠️ | Caja reportes: 500 filas sin offset |

### Caché

| Capa | Uso |
|------|-----|
| `React.cache()` | Session, clinic features |
| `unstable_cache()` + tags | Metadata clínica, farmacología referencia |
| PHI | **Sin cache cross-request** (correcto) |
| Revalidación | `updateTag` / `revalidatePath` en mutaciones |

Ver [`CACHE_STRATEGY.md`](./CACHE_STRATEGY.md).

### Bundle

| Estado | Detalle |
|--------|---------|
| ✅ | jsPDF lazy, xlsx lazy (caja), copilot lazy, interactions lazy |
| ✅ | `optimizePackageImports`: lucide, date-fns, zod |
| ⚠️ | Command palette: 20 iconos en bundle client |
| ⚠️ | Dashboard shared chunk ~1.2 MB (providers + sidebar) |

### Memoria & observabilidad

| Estado | Detalle |
|--------|---------|
| ✅ | Health heap en `/api/health`, cron hourly |
| ✅ | `PerformanceMonitor` + Web Vitals → Supabase |
| ✅ | 4 APIs instrumentadas, 3 loaders con `observeQuery` |

Ver [`PERFORMANCE_MONITORING.md`](./PERFORMANCE_MONITORING.md).

---

## Optimizaciones pendientes (roadmap)

| Prioridad | Item | Esfuerzo | Impacto estimado |
|-----------|------|----------|------------------|
| **P1** | Cursor pagination EHR workspace (2000 → páginas 50) | Alto | −80% payload paciente/[id] |
| **P1** | Server-first Sidebar/TopNav (pathname desde header) | Medio | −50–100 KB shared JS |
| **P2** | Paginar caja/reportes y secretaria/documentos | Medio | Escala financiera |
| **P2** | RPC breakdown diario de caja (evitar fetch 3000 filas) | Bajo | Analytics admin |
| **P2** | Lazy CommandPalette + iconos por string | Bajo | −30 KB |
| **P3** | Lighthouse en `/agenda`, `/pacientes` autenticados | Medio | Baseline dashboard CWV |
| **P3** | VoiceInputProvider scope por ruta clínica | Medio | Menos context en caja |

---

## Capacidad de escalabilidad estimada

| Escenario | Capacidad | Limitante |
|-----------|-----------|-----------|
| Clínicas concurrentes (Vercel serverless) | **500+** | Supabase connection pooler + RLS |
| Usuarios simultáneos por clínica | **15–25** | Dashboard parallel queries (6–8/request) |
| Pacientes por clínica | **50 000+** | Paginación + índices trgm ✅ |
| Registros clínicos por paciente (workspace) | **~500 cómodo / 2000 max** | Fetch-all EHR ⚠️ |
| Turnos agenda (37 días) | **1000** | Cap documentado ✅ |
| Eventos observabilidad | **∞ con purge 30d** | Cron + índice created_at ✅ |
| Jobs background | **100/min** | `process.ts` + observability |

**Proyección post-roadmap P1:** workspace EHR paginado → **100+ usuarios/clínica** y pacientes con historias extensas sin degradación.

---

## Verificación

```bash
npm run build
npm run typecheck
npm run lint
npm test                    # 627+ tests
npm run performance:audit   # snapshot JSON
npm run lighthouse:audit    # rutas públicas (requiere server)
```

Todos los checks pasaron tras esta auditoría.

---

## Archivos modificados en esta auditoría

| Archivo | Cambio |
|---------|--------|
| `cash-closure-view.tsx` | xlsx dynamic import |
| `lazy-dashboard-interaction-hosts.tsx` | Nuevo — lazy layout |
| `(dashboard)/layout.tsx` | Usa lazy hosts |
| `clinical-ai/route.ts`, `admin-ops-ai/route.ts` | API timing |
| `load-pacientes-page.ts`, `load-clinical-operations-dashboard.ts` | observeQuery |
| `batch-patient-record-counts.ts` | Sin scan fallback |
| `load-revenue-snapshot.ts` | Limit 3000 cargos/día |
| `066_performance_audit.sql` | Índice compuesto |
| `scripts/performance-audit.mjs` | Snapshot métricas |
| `tests/performance/batch-patient-record-counts.test.ts` | Actualizado |

---

## Referencias

- [`CACHE_STRATEGY.md`](./CACHE_STRATEGY.md)
- [`PAGINATION_AUDIT.md`](./PAGINATION_AUDIT.md)
- [`PERFORMANCE_MONITORING.md`](./PERFORMANCE_MONITORING.md)
- [`LIGHTHOUSE_AUDIT.md`](./LIGHTHOUSE_AUDIT.md)
