# PERFORMANCE_RESULTS_2026 — DrFlow Staging

**Fecha:** 2026-08-15  
**Rama:** `develop` (Staging / Preview)  
**Producción / `main`:** NO modificados  
**Base:** `PERFORMANCE_AUDIT_2026.md` (Fase 1)

---

## Cambios aplicados (bloque Pacientes → HC → Recetas → Agenda)

| Área | Antes | Después | Mejora esperada |
| ---- | ----- | ------- | --------------- |
| `/pacientes` conteos | Scan todos `clinical_records` + N× Storage HCE | 1× RPC `count_clinical_records_by_patients` | −1–N round-trips Storage; payload lista mucho menor |
| `/pacientes?seccion=historias` | Idem | Idem RPC | Idem |
| HC soap / `/consultas` | hasta **500** records | **20** iniciales + load-more | −96% rows en first paint |
| Recetas save | patient → pro → all coverage rules (serial) | patient ∥ pro; 1 rule by kind | −1–2 RTTs; menos payload rules |
| Recetas issue | draft before + draft again + serial ctx + revalidate ×3 listas | sin before duplicado; parallel ctx; revalidate paciente | −1–3 RTTs; menos RSC rebuild |
| Clinical create | revalidate `/pacientes` + `/historias` listas | paciente + `/consultas` | evita re-correr enrich P0 |
| Agenda | 3000 appts; blocks sin limit; default-pro serial | 1200 appts; blocks ≤400; default-pro en parallel | menor TTFB/payload |
| Historia detail embed | `select(*)` + related sin limit | columnas explícitas + limits | payload acotado |

---

## Tabla rutas (cualitativa — medir en Preview)

| Ruta | Antes (audit) | Después | Mejora |
| ---- | ------------- | ------- | -----: |
| `/pacientes` | P0 unbounded enrich | RPC count | alto |
| `/pacientes/[id]?tab=soap` | 500 records | 20 + paginación | alto |
| `/consultas` sesión | soap 500 | soap 20 | alto |
| Guardar/emitir receta | waterfall + bust listas | parallel + surfaces | alto |
| `/turnos/agenda` | 3000 + blocks ∞ | 1200 + 400 | medio-alto |

Métricas runtime (TTFB / Lighthouse) pendientes de corrida en Preview:

```bash
npm run performance:audit
npm run lighthouse:audit
```

---

## Queries / round-trips eliminados o reducidos

1. Listados: eliminado download CSV HCE por paciente de la página.
2. Listados: eliminado select full-text de todos los clinical_records de la página.
3. Recetas: eliminado load de **todas** las coverage rules (ahora `loadCoverageRuleForKind`).
4. Recetas issue: eliminado select `before` previo al service (audit usa result).
5. Recetas: eliminado `revalidatePath("/recetas")` y `/historias` list.
6. Clinical create: eliminado `revalidatePath("/pacientes")` y `/historias` list.
7. Agenda: default professional ya no espera al final del batch.

---

## Índices

Ninguna migración nueva. Índices existentes (046/054/061/087) cubren hot paths. RPC `count_clinical_records_by_patients` ya en 064.

---

## Riesgos pendientes

| Riesgo | Mitigación |
| ------ | ---------- |
| Badge “N consultas” en lista puede diferir del sidebar HC (días dedupe / HCE) | Aceptado: lista = # registros; HC = lógica completa al abrir |
| Print “HC completa” solo ve lo cargado (+ load-more) | Usuario debe “Cargar más” o ampliar fetch en print (P2) |
| Agenda >1200 turnos en ventana | Revisar ventana de fechas o paginar por día (P2) |
| Optimistic UI no aplicado en emisión clínica | Intencional (seguridad) |

---

## Confirmación entorno

| Ítem | Estado |
| ---- | ------ |
| Branch | `develop` |
| Push a `main` | No |
| Supabase Production | No tocado |
| Migraciones nuevas | No |

---

## Follow-up (bloque 2 — post `9ecab58`)

| Área | Cambio |
| ---- | ------ |
| Workspace HC | HCE + app-share + default-pro en el mismo `Promise.all` (menos waterfall) |
| Favoritos clínicos | `.limit(100)` |
| Clinical ops / dashboard core | today appointments ≤ 200 |
| `/consultas` día | appointments ≤ 100 |
| `/pacientes` page size | 20 → **25** |
| Recetas UX | `useTransition` alrededor de `router.refresh` tras issue/void/save |

### Bloque 3

| Área | Cambio |
| ---- | ------ |
| `/pami/planillas`, `/guia-pami` | `getDashboardPageContext` (1 shell cached) |
| `/consultas`, `/pacientes/[id]` | idem |
| PAMI loader | default-pro en paralelo con catalog |
| Sidebar | prefetch de hijos al abrir grupo; `prefetch` estable |
| Clinical top nav | `Link prefetch` |

### Bloque 4

| Área | Cambio |
| ---- | ------ |
| 23 páginas dashboard restantes | `getDashboardPageContext` (caja, config, atenciones, facturación, plantillas, etc.) |
| Auth serial en `page.tsx` del dashboard | Eliminado (`await getProfile()` = 0 en dashboard) |

---

## Archivos tocados (implementación)

- `src/lib/utils/batch-patient-record-counts.ts`
- `src/features/pacientes/server/load-patient-ehr-data.ts`
- `src/features/pacientes/server/patient-workspace-fetch-plan.ts`
- `src/features/recetas/actions/prescriptions.ts`
- `src/features/recetas/services/prescriptions.service.ts`
- `src/core/cache/revalidate-prescription-surfaces.ts` (nuevo)
- `src/features/historias/actions/clinical-records.ts`
- `src/features/historias/server/load-historia-detail-page.ts`
- `src/app/(dashboard)/turnos/agenda/page.tsx`
- `src/core/supabase/pagination.ts`
- `tests/performance/batch-patient-record-counts.test.ts`
- `PERFORMANCE_AUDIT_2026.md` / este archivo
