# PERFORMANCE_AUDIT_2026 — DrFlow Staging

**Fecha:** 2026-08-17  
**Entorno:** Staging / Preview únicamente (`develop`)  
**Producción / `main` / Supabase Production:** NO modificados  
**Stack:** Next.js 16 · React 19 · Supabase/PostgreSQL · RLS  
**Alcance:** Re-auditoría sobre el código actual (ciclo 15-ago ya aplicó paginación HC, RPC de conteos, recetas estrechas)

**Rama verificada:**

```text
git branch --show-current → develop
git status → clean (solo .tmp-* untracked)
```

---

## Resumen ejecutivo

La base de Fase 1–6 del 15-ago **sigue en pie** (lista 25 pacientes, soap 20 + load-more, RPC de conteos, `revalidatePrescriptionSurfaces`). La lentitud residual que el médico sigue percibiendo viene de:

1. **Dashboard** que, además del RPC de métricas, **siempre** baja 30 días de `appointments` “por si falla el RPC”.
2. **Server Actions clínicas** con ownership **serial** (paciente → profesional → registro/turno) aunque las FKs son independientes.
3. **`revalidatePath("/historias")`** al subir/borrar adjuntos — invalida listados caros sin necesidad.
4. **Portal context sin caché** en `/pacientes` e historia detail, en serie antes del fetch principal.
5. **Coverage rules** (metadata de clínica, no PHI) consultadas en cada carga de workspace en vez de `unstable_cache`.
6. Botones clínicos con spinner, pero texto de submit que no cambia a “Guardando…” / “Emitiendo…”.

No hay `select("*")` en rutas clínicas críticas. Índices hot-path ya existen (046/054/061/087). **No se propone migración nueva** sin `EXPLAIN ANALYZE` en Staging.

---

## Tabla por ruta (estado al 17-ago, antes de este ciclo)

| Ruta | Queries | Secuenciales | Datos cargados | Riesgo | Prioridad |
| ---- | ------: | -----------: | -------------: | ------ | --------- |
| `/pacientes` | ~4–7 | Portal uncached → search → enrich RPC | 25 pacientes; conteo RPC | Medio: portal serial | **P1** |
| `/pacientes?seccion=historias` | ~4–6 | Idem | 25 records + RPC count | Medio | **P1** |
| `/pacientes/[id]` shell | ~3–6 | Auth cache | Ficha + Suspense | Bajo | **P2** |
| `/pacientes/[id]?tab=resumen` | ~12–16 | Parallel + children dx/tx | 80 records, 200 att, 100 Rx | Medio | **P1** |
| `/pacientes/[id]?tab=soap` | ~12–16 | Parallel; coverage rules live | **20** records + HCE + templates | Medio (ya no 500) | **P1** |
| `/consultas` sesión | ~12–18 | Extra `getSession` (cache hit) | Plan soap 20 | Medio | **P1** |
| `/historias/[id]?embed=1` | ~8–10 | Record → portal uncached → related | Related con limit | Medio | **P1** |
| Recetas lista (workspace) | 1 list | OK | limit 100 | Bajo | **P2** |
| `savePrescriptionDraft` | ~6–9 hops | Ownership serial + rule post-ctx | Columnas explícitas | Alto en botón | **P0** |
| `issuePrescription` | ~8–12 hops | Ownership serial; rule después de patient∥pro | REFEPS extra | Alto en botón | **P0** |
| `voidPrescription` | ~5–7 | Select `before` + void (otro select) | Fila completa al void | Medio-alto | **P1** |
| Adjuntos clínicos | mutate + 3 paths | — | — | `revalidate /historias` | **P1** |
| `/turnos/agenda` | ~5–7 | Parallel | 1200 appts / 400 blocks | Medio | **P2** |
| `/dashboard` | RPC + **30 días raw** + hoy + blocks | Parallel pero fallback siempre | Hoy unbounded + 30d | TTFB | **P0** |
| `/pami/planillas` | ~5–8 | Shell cached | 50 pacientes | Bajo | **P2** |

---

## Hallazgos residuales (este ciclo)

### P0 — Dashboard `loadTurnosReportesPageData`

`fallbackAppointments` (30 días de turnos) corre en el **mismo** `Promise.all` que el RPC. Si el RPC funciona, esa query es desperdicio puro.

Hoy y `schedule_blocks` del día **sin `.limit()`**.

### P0 — Ownership serial en acciones

`verifyPrescriptionForeignKeys` / `verifyClinicalRecordForeignKeys` / `verifyAppointmentForeignKeys` esperan paciente, luego profesional, luego el opcional. Pueden ir en `Promise.all` **sin debilitar RLS ni tenant isolation**.

`requireClinicalIssueAccess` espera sesión → clinicId → clinic (los tres son `React.cache`; el primer request de una Server Action igual serializa el arranque).

### P1 — `revalidatePath` shotgun residual

| Acción | Paths | Problema |
| ------ | ----- | -------- |
| Upload/delete adjunto | `/historias` + paciente + `/consultas` | `/historias` es redirect/listado |
| `createClinicalRecord` + turno | agenda + dashboard + **atenciones** | Atenciones no cambia al crear SOAP |
| Import PDF clínico | `revalidateClinicalSurfaces()` = `/historias` + `/pacientes` | Justificado (bulk) |

### P1 — Portal y coverage rules

- `/pacientes` e historia detail usan `getPortalContextForClinic` (uncached) en serie.
- Workspace ya usa `getCachedPortalContext`.
- `coverage_rules` es metadata de clínica: candidato a `unstable_cache` + tag (igual que professionals/templates). **No es PHI.**

### P1 — UX botones

Spinner existe (`loading` / `acting` / `finalizing`). Falta texto inmediato “Guardando…” / “Emitiendo…” en consulta, receta y órdenes. **Sin optimistic UI clínico.**

### P2 — Agenda / PAMI / índices

Agenda 1200 + 400 es aceptable para la ventana −30d / horizonte. PAMI ya pagina 50. Índices `clinic_id + created_at` / `patient_id + created_at` / trgm nombres ya existen.

---

## Ya resuelto (ciclo 15-ago, no revertir)

| Ítem | Estado |
| ---- | ------ |
| Conteos lista = RPC `count_clinical_records_by_patients` | OK |
| Soap/consulta first paint = 20 + load-more | OK |
| Print HC = fetch on-demand hasta 2000 | OK |
| `revalidatePrescriptionSurfaces` estrecho | OK |
| Agenda max 1200 / blocks 400 | OK |
| Historia detail sin `select(*)` | OK |
| Sidebar `<Link prefetch>` | OK |
| `getDashboardPageContext` en páginas dashboard | OK |
| `PACIENTES_PAGE_SIZE = 25` | OK |

---

## Objetivos de referencia

| Métrica | Objetivo |
| ------- | -------- |
| Feedback visual botón | &lt;100 ms |
| Navegación percibida | &lt;300 ms |
| Pantalla usable | &lt;1 s |
| TTFB rutas principales | &lt;800 ms ideal |
| Consulta DB habitual | &lt;100 ms |

---

## Seguridad (innegociable)

- Authentication / clinic_id / tenant isolation / ownership
- RLS
- Validaciones clínicas
- `audit_logs` / trazabilidad
- Sin service role en cliente
- Sin cache PHI cross-tenant (coverage rules = metadata de clínica)

---

## Confirmaciones

| Ítem | Estado |
| ---- | ------ |
| Rama | `develop` (staging) |
| Producción / `main` | **No** |
| Supabase Production | **No** |
| Migración nueva | **No** (índices existentes suficientes) |
| Siguiente paso | Fase 5 HC paginación residual / Fase 6 pacientes, si hace falta |

---

*Re-auditoría 17-ago. Ciclo 1: dashboard fallback, ownership paralelo, portal/coverage cache, revalidate estrecho, copy pending. Ciclo 2 (Fase 2): Server Actions. Ciclo 3 (Fase 3): `revalidatePath` — sin stubs `/historias` `/recetas` `/agenda`; turnos/atenciones solo si el dato cambió.*
