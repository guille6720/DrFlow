# PERFORMANCE_AUDIT_2026 — DrFlow Staging

**Fecha:** 2026-08-15  
**Entorno:** Staging / Preview únicamente (`develop`)  
**Producción / `main` / Supabase Production:** NO modificados  
**Stack:** Next.js 16 · React 19 · Supabase/PostgreSQL · RLS  
**Alcance:** Fase 1 — medir antes de modificar (sin cambios de código)

**Rama verificada:**

```text
git branch --show-current → develop
git status → clean (solo .tmp-* untracked)
```

---

## Resumen ejecutivo

La lentitud percibida no viene de “falta de índices” en pacientes (ya hay `pg_trgm` y compuestos), sino de:

1. **Listas de pacientes/historias** que, para mostrar “N consultas”, bajan **todos** los `clinical_records` de la página + descargas HCE CSV (`batchPatientConsultationCounts`).
2. **Historia Clínica / consulta (tab soap)** que carga hasta **500** registros clínicos + hijos dx/tx + HCE en la primera pintura.
3. **Server Actions de recetas** con waterfalls largos (sesión → ownership → patient → professional → todas las coverage rules → mutate → audit → `revalidatePath` masivo).
4. **Agenda** con ventana amplia y límite **3000** turnos + `schedule_blocks` sin `.limit()`.
5. **`revalidatePath` shotgun** (`/pacientes`, `/historias`, `/recetas`, `/agenda`, `/dashboard`) tras mutaciones clínicas, que fuerza re-ejecutar los loaders caros de arriba.

Ya existe buena base: paginación de pacientes (20), plan por tab del workspace, `loadMore` keyset, `React.cache` / `unstable_cache` de metadata clínica, `loading.tsx` en pacientes/agenda/pami.

---

## Tabla por ruta (Fase 1)

| Ruta | Queries | Secuenciales | Datos cargados | Riesgo | Prioridad |
| ---- | ------: | -----------: | -------------: | ------ | --------- |
| `/pacientes` | ~5–10+ (+ HCE storage) | Sí: portal → search → enrich | 20 pacientes; **todos** los clinical_records de esos IDs para conteo; HCE CSV por adjunto | Alto: latencia escala con volumen HC | **P0** |
| `/pacientes?seccion=historias` | ~4–6 (+ mismos conteos) | Search → count+page → enrich | 25 records/página + conteos unbounded | Mismo hot path de conteos | **P0** |
| `/pacientes/[id]` (shell) | ~3–6 (auth cache) | Auth encadenado → patient | Ficha paciente; workspace en Suspense | Medio; auth serial mitigado por cache | **P2** |
| `/pacientes/[id]?tab=resumen` | ~12–16 | Parallel batch → HCE → share → children | 80 records, 200 att, 100 Rx, 50 orders, 80 appts | Medio-alto pero acotado | **P1** |
| `/pacientes/[id]?tab=soap` (HC) | ~12–18 | Idem + children dx/tx | **hasta 500** clinical_records + HCE + templates | Payload/TTFB crítico | **P0** |
| `/consultas` (sesión) | ~12–18 | Auth → patient → soap loader | Siempre plan `soap` (500) | Igual que HC soap | **P0** |
| Tab switch workspace | Full plan del tab | Auth + patient + workspace | Cache cliente por tab (bien) | Re-fetch completo al cambiar tab | **P2** |
| `/historias/[id]?embed=1` | ~9–11 | Record `*` → portal → related | Record completo; Rx/orders/att **sin limit** | Relacionados unbounded | **P1** |
| `/historias` / redirects | 0–2 | Redirect | — | Bajo | **P3** |
| Recetas (en workspace) | 1 list (+ sheet) | List OK; **actions** waterfall | List limit 100 | Actions = cuello de botón | **P0** (actions) |
| `savePrescriptionDraft` | ~8–12 hops | Largo waterfall | Full-row `.select()` en mutate | Botón lento | **P0** |
| `issuePrescription` | ~10–14 hops | Peor cadena (+ REFEPS) | Draft duplicado; all coverage rules | Botón más lento | **P0** |
| Órdenes médicas update | ~6–10 | Serial ownership/version | Full-row select | Alto en update | **P1** |
| `/turnos/agenda` | ~5–7 | Parallel + default pro después | hasta **3000** appts; blocks sin limit | TTFB/RSC payload | **P0** |
| `/dashboard` (live) | shell + turnos metrics | Shell → metrics | No usa clinical-ops async | Medio | **P2** |
| `loadClinicalOperationsDashboard*` | 6+ | Parallel; today **sin limit** | Hoy unbounded | Riesgo si se remonta | **P1** |
| `/pami/planillas` | ~5–8 | Auth page serial; patients paginados 50 | Catalog cached | Medio | **P2** |
| Favoritos clínicos (consulta) | 2 on mount | Parallel | Favoritos **sin limit**; recent 40 | Crece con uso | **P2** |

---

## Hallazgos detallados por área

### 1. Pacientes (`/pacientes`) — P0

**Qué está bien**

- `PACIENTES_PAGE_SIZE = 20` (dentro del objetivo 25–50; se puede subir a 25–50 sin romper patrón).
- Búsqueda vía RPC / PostgreSQL (`searchPatientsForClinicListPage`), no “traer todos y filtrar en JS” en el path principal.
- Índices existentes: `clinic_id`, document digits, `last_name`/`first_name`/`document` **trgm**, `clinic_active_lastname`, etc. (061, 054, 087, 088).

**Qué duele**

- `batchPatientConsultationCounts` (`src/lib/utils/batch-patient-record-counts.ts`):
  - `SELECT` de **todos** los `clinical_records` de los pacientes de la página **sin `.limit()`**.
  - Más descargas Storage de `hce-export-resumen.csv` por paciente con adjunto.
  - Se ejecuta en **cada** carga de listado (pacientes e historias).
- Hay RPC `count_clinical_records_by_patients` para conteo simple, pero el conteo “visible en HC” fuerza el path pesado.

**Acción propuesta (Fase 6, sin implementar aún)**

- Contar en SQL (RPC dedicado alineado a la regla de negocio) o mostrar `clinical_records` count simple en lista.
- Reservar merge HCE+sidebar solo al abrir HC del paciente.

### 2. Historia Clínica / soap — P0

**Qué está bien**

- Plan por tab (`getWorkspaceFetchPlan`).
- `loadMorePatientClinicalRecords` keyset (página 80).
- Suspense + `pacientes/[id]/loading.tsx`.

**Qué duele**

- `PATIENT_EHR_RECORD_LIMIT = 500` en tab `soap` y sesiones `/consultas`.
- Objetivo de producto (Fase 5): **últimas ~20 evoluciones** + “Ver anteriores”.
- Post-`Promise.all`: HCE download, app-share, children dx/tx, default professional (waterfall residual).
- `loadClinicalRecordChildrenForPatient` sin `.limit()` sobre todos los IDs cargados.
- Print “HC completa” usa snapshot en memoria → incompleta si no se cargó todo (trade-off a documentar al bajar a 20).

**Acción propuesta (Fase 5)**

- Initial soap: `PATIENT_EHR_RECORD_PAGE_SIZE` (20–80) + load-more.
- Print/export: fetch explícito server-side con límite documentado.
- Meter HCE lookup en el primer batch cuando `plan.hceSummary`.

### 3. Recetas — P0 (acciones) / P2 (lista)

- Lista en workspace: columnas explícitas, limit 100.
- `savePrescriptionDraft` / `issuePrescription`: muchos round-trips seriales; carga **todas** las coverage rules y filtra en JS; `.select()` vacío = fila completa; `revalidatePath("/recetas")` es casi no-op (ruta redirect).
- Modelo bueno a copiar: `revalidateMedicalOrderSurfaces` (paciente + record).

### 4. `revalidatePath` — P1 transversal (Fase 3)

Patrones costosos observados:

| Acción | Paths típicos | Problema |
| ------ | ------------- | -------- |
| Clinical records create/update | `/historias`, `/consultas`, `/pacientes`, `/pacientes/[id]`, a veces agenda/dashboard | Invalida listados P0 |
| Prescriptions | `/recetas`, `/historias`, a veces `/pacientes/[id]` | `/recetas` inútil; `/historias` ancho |
| Appointments / waiting room | agenda + dashboard + atenciones + consultas + sala | Amplio pero parcialmente justificado |
| Settings / signatures | layout `/pacientes`, `/historias` | Bustea caché de listas |

**Preferir:** `revalidatePath(\`/pacientes/${id}\`, "page")` + tags de metadata clínica; evitar `/pacientes` y `/historias` list salvo create/delete de paciente.

### 5. Agenda — P0

- `APPOINTMENTS_AGENDA_MAX = 3000` + join anidado.
- `schedule_blocks` sin `.limit()`.
- Default professional **después** del `Promise.all`.
- Dialogs con `next/dynamic` (bien).

### 6. Dashboard — P2 / P1 (código legacy)

- Dashboard live ≠ `ClinicalOpsDashboardAsync` (parece desmontado).
- Loaders clinical-ops: “hoy” **sin limit** → P1 si se vuelve a montar.
- Widgets secundarios limit 8 + Suspense: patrón a reutilizar.

### 7. PAMI — P2

- Pacientes paginados 50; catálogo cached.
- Auth page no usa `getDashboardShell` / `getDashboardPageContext` de forma unificada.

### 8. `select("*")` — P1 puntual

- Casi no hay `select("*")` en features clínicas.
- Excepción notable: `load-historia-detail-page.ts` usa `"*, patients(...), professionals(...)"`.
- Mutaciones de recetas usan `.select()` vacío → retorno full-row (equivalente funcional a `*`).

### 9. UX botones / Client — P1 (Fase 4)

- Muchos flujos: click → server action → `revalidatePath` + `router.refresh()` → UI tarda.
- Ya hay `useTransition` en load-more HC; falta pending visual consistente en guardar/emitir receta y finalizar consulta.
- **No** optimistic UI en firmas clínicas / emisión REFEPS / void (riesgo médico).

### 10. Navegación / Suspense — P2 (Fase 9)

- `loading.tsx` presente: pacientes, pacientes/[id], agenda, pami, caja, dashboard shell.
- Falta auditar sidebar: preferir `<Link>` + prefetch vs `router.push` donde aún exista.
- Tab workspace ya evita RSC full nav (`history.replaceState` + server action) — mantener.

### 11. Caché — OK (Fase 10)

Reutilizar, no reinventar:

- `src/core/auth/session.ts` (`React.cache`)
- `src/lib/server/cached-clinic-queries.ts`
- `clinic-metadata-unstable-cache.ts` + tags
- `revalidate-clinic-cache.ts` / `cache-tags.ts`

**Nunca** cachear PHI entre pacientes/clínicas.

### 12. Índices — P3 (Fase 8, solo si EXPLAIN lo pide)

Ya existen hot paths principales:

- `idx_clinical_records_clinic_patient_created`
- `idx_clinical_records_clinic_created`
- `idx_patients_clinic_active_lastname` + trgm nombre/documento
- favorites/recent usage (114/115)

**No crear migración nueva sin `EXPLAIN ANALYZE` en Staging.** Candidatos a evaluar (no duplicar):

- Conteos agregados por `patient_id` (mejor RPC que índice extra).
- `appointments(clinic_id, start_at)` si falta compuesto usado por agenda.

---

## Waterfalls típicos (diagramas)

### Lista pacientes

```text
getDashboardPageContext
  → portal
  → search/list page (RPC/range)
  → enrichPacientesPageRows
       ├─ batchPatientConsultationCounts  ← P0 unbounded + HCE
       └─ shares
```

### Soap / consulta

```text
auth (cached)
  → patient
  → Promise.all(records≤500, att, rx, …)
  → HCE download          ← secuencial
  → app share             ← secuencial
  → dx/tx children        ← depende de IDs (OK)
  → default professional  ← secuencial
```

### issuePrescription (conceptual)

```text
requireClinicalIssueAccess
  → before select draft
  → getPrescriptionDraftForIssue (otra vez)
  → patient + professional (serial)
  → load ALL coverage rules → find one
  → events / refeps / update / audit
  → revalidatePath ×3
```

---

## Clasificación de backlog (orden de implementación)

| ID | Ítem | Prioridad | Fase |
| -- | ---- | --------- | ---- |
| A1 | Reemplazar/abaratar `batchPatientConsultationCounts` en listados | P0 | 6 |
| A2 | Soap/consulta: 20–80 inicial + load-more (no 500) | P0 | 5 |
| A3 | Colapsar save/issue prescription round-trips + revalidate estrecho | P0 | 2–3 |
| A4 | Agenda: bajar max / limitar blocks / parallel default-pro | P0 | 9/agenda |
| B1 | Historia detail: quitar `*`, limitar related | P1 | 7 |
| B2 | Fold HCE+share en primer `Promise.all` workspace | P1 | 5 |
| B3 | Narrow `revalidatePath` clinical/prescriptions | P1 | 3 |
| B4 | Cap today appointments en clinical-ops loaders | P1 | 11 |
| B5 | Pending UI en botones clínicos (`useTransition`) | P1 | 4 |
| C1 | Cap favorites; day consultas `.limit` | P2 | 5–7 |
| C2 | PAMI/auth: `getDashboardPageContext` | P2 | 10 |
| C3 | Sidebar Link/prefetch audit | P2 | 9 |
| D1 | Índices solo tras EXPLAIN Staging | P3 | 8 |

---

## Objetivos de referencia (para Fase 12)

| Métrica | Objetivo |
| ------- | -------- |
| Feedback visual botón | &lt;100 ms |
| Navegación percibida | &lt;300 ms |
| Pantalla usable | &lt;1 s |
| TTFB rutas principales | &lt;800 ms ideal |
| Consulta DB habitual | &lt;100 ms |

Métricas **antes** de cambios: esta auditoría (estática). Métricas **después**: `PERFORMANCE_RESULTS_2026.md` + `npm run performance:audit` / `performance:gate` / `lighthouse:audit` en Staging.

---

## Seguridad (innegociable)

En todas las fases se mantiene:

- Authentication / clinic_id / tenant isolation / ownership
- RLS
- Validaciones clínicas
- `audit_logs` / trazabilidad
- Sin service role en cliente
- Sin cache PHI cross-tenant

---

## Confirmaciones

| Ítem | Estado |
| ---- | ------ |
| Rama | `develop` (staging) |
| Código modificado en Fase 1 | **Ninguno** |
| Producción / `main` tocados | **No** |
| Supabase Production tocado | **No** |
| Siguiente paso | Fase 2–6 empezando por **Pacientes conteos** → **HC paginación** → **Recetas actions** |

---

## Referencias de código (hotspots)

| Archivo | Nota |
| ------- | ---- |
| `src/lib/utils/batch-patient-record-counts.ts` | Conteos unbounded + HCE |
| `src/features/pacientes/server/load-pacientes-page.ts` | Enrich en lista |
| `src/features/pacientes/server/load-patient-ehr-data.ts` | `PATIENT_EHR_RECORD_LIMIT = 500` |
| `src/features/pacientes/server/patient-workspace-fetch-plan.ts` | soap → 500 |
| `src/features/pacientes/server/load-patient-workspace-page.ts` | Waterfall post-parallel |
| `src/features/historias/server/load-historia-detail-page.ts` | `select("*",…)` + related sin limit |
| `src/features/historias/actions/clinical-records.ts` | revalidate amplio |
| `src/features/recetas/actions/prescriptions.ts` | waterfall + revalidate |
| `src/app/(dashboard)/turnos/agenda/page.tsx` | 3000 appts |
| `src/core/supabase/pagination.ts` | constantes de límites |
| `src/core/cache/revalidate-medical-order-surfaces.ts` | patrón a reutilizar |

---

*Fin Fase 1. Esperando confirmación para iniciar implementación por bloque (Pacientes → HC → Recetas), con tests y gate de performance al cierre de cada bloque.*
