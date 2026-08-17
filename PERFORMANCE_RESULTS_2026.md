# PERFORMANCE_RESULTS_2026 — DrFlow Staging

**Fecha:** 2026-08-17  
**Rama:** `develop` (Staging / Preview)  
**Producción / `main`:** NO modificados  
**Base:** `PERFORMANCE_AUDIT_2026.md` (re-auditoría 17-ago)

---

## Qué causaba la lentitud residual

El ciclo del 15-ago ya había bajado SOAP a 20 registros y los conteos de `/pacientes` a un RPC. Lo que todavía se sentía lento:

1. **Dashboard** ejecutaba siempre un scan de **30 días** de `appointments` “por si fallaba el RPC” (en el mismo `Promise.all`).
2. **Server Actions** (receta, consulta, turno, caja) verificaban FKs **en serie** (paciente → profesional → registro).
3. **Anular receta** hacía un SELECT extra antes del UPDATE.
4. **Portal** en `/pacientes` e historia detail no reutilizaba `getCachedPortalContext`.
5. **Coverage rules** (metadata de clínica) se leían en vivo en cada workspace.
6. **Adjuntos** invalidaban `/historias` (listado) sin necesidad.
7. Botones con spinner pero sin copy “Guardando…” / “Emitiendo…”.

---

## Tabla rutas (cualitativa)

| Ruta | Antes (17-ago audit) | Después | Mejora |
| ---- | -------------------- | ------- | -----: |
| `/dashboard` | RPC + 30d raw siempre | RPC + hoy ≤200; 30d solo si RPC falla | alto |
| `save/issue` receta | ownership 2–3 RTTs serial | Promise.all FKs; rule en paralelo al issue | alto |
| `voidPrescription` | SELECT + UPDATE | UPDATE … RETURNING | medio |
| `/pacientes` | portal uncached serial | portal cached ∥ search | medio |
| `/pacientes/[id]` soap | coverage rules live | `unstable_cache` clinic tag | medio |
| `/historias/[id]` | record → portal serial | record ∥ portal cache | medio |
| Adjuntos | `revalidatePath("/historias")` | paciente + consulta (+ embed) | medio |
| Botones clínicos | spinner | spinner + “Guardando/Emitiendo” | UX &lt;100 ms |
| `/consultas` | extra `getSession` | `profile.id` del shell | bajo |

---

## Métricas medidas (2026-08-17)

**Typecheck:** `npm run typecheck` OK  
**Performance gate:** `npm run performance:gate` OK — **71** tests (antes 70).  
**Tests de este ciclo:** ownership-guard, intelligent-cache, progressive-loading, supabase-query-cache, turnos-module, patient-workspace-loader — **41/41**.  
**Lint de archivos tocados:** OK.  
**Lint repo completo / `npm test`:** fallos **preexistentes** en `develop` (import-sort en `src/lib/actions/*` no tocados; CSRF billing; migraciones 117; hrefs de navegación clínica). No introducidos por este cambio.

### Queries / round-trips eliminados

1. Dashboard: 1 query de 30 días de turnos en el happy path del RPC.
2. Ownership: 1–2 RTTs seriales por mutación clínica (ahora 1 RTT paralelo).
3. Void receta: 1 SELECT previo.
4. `/pacientes` / historia detail: portal deja de ser un fetch extra uncached.
5. Workspace: coverage rules dejan de pegarle a Postgres en cada tab (TTL 300s + `updateTag` al guardar reglas).
6. Adjuntos: dejan de invalidar el listado `/historias`.
7. Create SOAP: deja de invalidar `/atenciones`.

### Índices

Ninguna migración nueva. Cubiertos por 046/054/061/087/088. `EXPLAIN ANALYZE` en Staging sigue pendiente para confirmar `appointments(clinic_id, start_at)` vs índice existente `(clinic_id, professional_id, start_at)`.

---

## Objetivos de referencia

| Métrica | Objetivo | Estado |
| ------- | -------- | ------ |
| Feedback visual botón | &lt;100 ms | ✅ `setState` + spinner + copy inmediato (sin optimistic clínico) |
| TTFB públicas (ciclo previo) | &lt;800 ms | ✅ medido 15-ago |
| TTFB clínicas autenticadas | &lt;800 ms | Requiere sesión Preview; no medido en este entorno local sin login |
| Gate tests | pass | ✅ 71 |

---

## Riesgos pendientes

| Riesgo | Mitigación |
| ------ | ---------- |
| RPC de dashboard caído → fallback 30d (hasta 1500 filas) | Aceptable; path infrecuente |
| Ownership paralelo consulta profesional aunque el paciente falle | Extra query solo en error; checks no se omiten |
| Coverage rules cache 300s | Invalidación inmediata al guardar/resetear reglas |
| Print HC completa | Sin cambio: fetch on-demand hasta 2000 |
| Optimistic UI emisión/anulación | No aplicado (seguridad clínica) |
| Lint/test repo en `develop` | Preexistente; no bloquea este commit de perf |

---

## Fase 2 — Server Actions (round-trips)

Objetivo: botones clínicos más rápidos **sin** optimistic UI, sin debilitar RLS/ownership/audit.

| Acción | Antes | Después |
| ------ | ----- | ------- |
| `requireClinicPermission` | clinic + permisos; `getSession` extra en cada mutación | sesión ∥ clinic ∥ permisos; devuelve `userId` |
| SOAP create/update | gate → client; `updateConsultationAt` re-auth vía `updateClinicalRecord` | gate ∥ client; persist directo |
| Receta save/issue/void/dispense | access → client; draft patient→pro serial | access ∥ client; patient ∥ pro ∥ coverage hint |
| Órdenes update/void | SELECT extra de versión | un SELECT issued + ownership ∥ load |
| Turnos / caja / lista de espera | `getSession` después del gate | `access.userId`; access ∥ client |
| Adjuntos | arrayBuffer → client serial | arrayBuffer ∥ client |
| Catálogo dx/tx | session ∥ clinic → client | session ∥ clinic ∥ client |

`await logAudit` / `await recordAudit` en updates se mantiene (serverless no debe freeze antes del audit). Create SOAP sigue con `void logAudit` (preexistente).

---

## Fase 3 — `revalidatePath`

Objetivo: no invalidar listados ni redirects cuando sólo cambió una receta, evolución, orden o turno.

`/historias`, `/recetas` y `/agenda` son **redirect stubs**. Invalidarlos no refresca UI y ensucia el router cache.

| Mutación | Antes | Después |
| -------- | ----- | ------- |
| Receta save/issue/void | paciente + historia + **`/consultas`** | paciente + historia embed |
| SOAP create | consultas + paciente + **agenda + dashboard** | consultas + paciente; `/turnos/agenda` sólo si hay turno |
| Adjunto clínico | paciente + **consultas** + historia | paciente + historia embed |
| Turno create/update | agenda stub + turnos + dashboard + **atenciones** + form nuevo | `/turnos/agenda` + dashboard + paciente |
| Turno → atendido / finalizar | ídem + atenciones | atenciones + consultas + sala de espera |
| Plantillas receta / SOAP | **`/pacientes` layout** + `/recetas` | `/plantillas-recetas` o `/plantillas` + cache tag |
| Coverage rules | tag + **pacientes layout** | tag + `/configuracion` |
| Firmas | **historias/pacientes layout** + recetas | `/firmas` + tag professionals |
| Import bulk | `/pacientes` + **`/historias`** | `/pacientes` |

La página actual se refresca sola al terminar la Server Action. `revalidatePath` queda para las otras superficies que muestran el mismo dato.

---

## Fase 4 — UX instantánea de botones

Objetivo: feedback visual &lt;100 ms al click (spinner + disabled + texto pending). **Sin optimistic UI** en receta, SOAP, órdenes ni indicadores clínicos.

`Button` ahora acepta `pendingLabel` y pone `aria-busy` mientras `loading`. El `setState`/`startTransition` sigue ocurriendo **antes** del `await`.

| Superficie | Pending |
| ---------- | ------- |
| Consulta / evolución (EHR, DrApp, modal) | Guardando... |
| Paciente alta/edición / indicadores | Guardando... |
| Receta dispensada / REFEPS | Marcando... / Enviando... |
| Orden anular | Anulando... |
| Turno confirmar / lista de espera / sala | Confirmando... / Guardando... |
| Planilla PAMI → historial | Guardando... |

No se muestra como emitida/anulada/atendida una receta o consulta hasta que el servidor confirma.

---

## Fase 5 — Historia Clínica first paint

Objetivo: el paciente abre en **últimas 20 evoluciones**. El resto va por “Ver anteriores” (SOAP sidebar, páginas de 80). No se bajan cientos de SOAP para esconderlos en React.

| Tab | Antes | Ahora |
| --- | ----- | ----- |
| `resumen` (default) | 80 evoluciones + 200 att + 100 Rx + 80 turnos | **20** evoluciones + 40 att + 20 Rx + 20 órdenes + 20 turnos |
| `soap` / `/consultas` | 20 evoluciones (ya) | 20 evoluciones; Rx de contexto 20 |
| `timeline` | 80 evoluciones | **20** (mismo first paint) |
| `diagnosticos` / `problemas` | 100 evoluciones | **20** (problem list sigue en `patient_problem_list`) |
| `recetas` / `ordenes` | 50 evoluciones de contexto | **0** evoluciones (la lista no las usa) |
| `archivos` / `estudios` | 100 evoluciones | adjuntos 200, sin evoluciones |

Alertas, diagnósticos/tratamientos activos y última consulta salen de perfil clínico + problem list + esas 20 evoluciones. Impresión on-demand sigue en tope 2000.

---

## Fase 6 — Lista de pacientes

Objetivo: `/pacientes` pagina **25** filas en PostgreSQL (rango 25–50). La búsqueda de nombre/DNI sigue en RPC `search_patients_for_clinic`. No se trae el padrón completo para filtrar en React.

| Ítem | Estado |
| ---- | ------ |
| Página default / PAMI / RPC search | `.range(25)` o RPC offset |
| Nombre/DNI | SQL (`search_patients_for_clinic` + count) |
| Patología + nombre | RPC en **paralelo**, luego intersect |
| Cap `.in(id)` | 500 IDs únicos (evita URL/payload enorme) |
| Fallback patología (sin RPC) | scan `clinical_records` con `.limit(2000)` |
| Índices | Ya existen: `idx_patients_clinic_active_lastname`, GIN `pg_trgm` (nombre/apellido/DNI/tel), DNI dígitos. **Sin migración nueva.** |

---

## Fase 7 — `select("*")` / returning wildcard

Las lecturas de pacientes, HC, recetas, órdenes, agenda y profesionales **ya** usaban columnas explícitas. El residual era `.select()` vacío en insert/update (PostgREST = SELECT *).

| Superficie | Returning |
| ---------- | --------- |
| Paciente insert | `PATIENT_DETAIL_COLUMNS` |
| Receta insert/update/emit/anular/dispensar/REFEPS | `PRESCRIPTION_ISSUE_COLUMNS` |
| Orden insert/update | `MEDICAL_ORDER_IDEMPOTENCY_COLUMNS` |
| Turno create | `APPOINTMENT_AGENDA_COLUMNS` |

No se tocaron repositorios de caja/billing (`clinic_subscriptions.select("*")` queda fuera del hot path clínico).

---

## Confirmación entorno

| Ítem | Estado |
| ---- | ------ |
| Branch | `develop` |
| Push a `main` | No |
| Supabase Production | No tocado |
| Migraciones nuevas | No |

---

## Archivos tocados (este ciclo)

- `src/core/security/ownership-guard.ts`
- `src/core/services/clinical-access.service.ts`
- `src/core/actions/clinic-guard.ts`
- `src/core/cache/cache-tags.ts` / `revalidate-clinic-cache.ts`
- `src/core/supabase/pagination.ts`
- `src/features/turnos/server/load-turnos-config-page.ts`
- `src/features/pacientes/server/load-pacientes-page.ts`
- `src/features/pacientes/server/load-patient-workspace-page.ts`
- `src/features/pacientes/server/load-clinical-structure.ts`
- `src/features/pacientes/actions/patient-attachments.ts`
- `src/features/historias/server/load-historia-detail-page.ts`
- `src/features/historias/actions/clinical-records.ts`
- `src/features/recetas/actions/prescriptions.ts` / `coverage-rules.ts`
- `src/features/recetas/services/prescriptions.service.ts`
- `src/lib/server/cached-clinic-metadata.ts` / `cached-clinic-queries.ts`
- `src/app/(dashboard)/consultas/page.tsx` + `loading.tsx`
- Botones: consulta, receta, órdenes, finalizar
- Tests de cache / pagination
- `PERFORMANCE_AUDIT_2026.md` / este archivo

### Fase 2 (Server Actions)

- `src/core/actions/clinic-guard.ts` (`userId` en el gate)
- `src/features/historias/actions/clinical-records.ts` / `clinical-diagnoses.ts` / `clinical-treatments.ts`
- `src/features/recetas/actions/prescriptions.ts` / `medical-orders.ts` / `coverage-rules.ts` / `prescription-templates.ts`
- `src/features/recetas/services/prescriptions.service.ts`
- `src/features/pacientes/actions/patients.ts` / `patient-attachments.ts` / `patient-chart-indicators.ts`
- `src/lib/actions/appointments.ts` / `cash-register.ts` / `waiting-room.ts`
- `src/features/turnos/actions/create-turno-wizard.ts` / `reschedule-appointment.ts` / `waiting-list.ts` / `fetch-turnos-wizard-slots.ts`

### Fase 3 (`revalidatePath`)

- `src/core/cache/revalidate-appointment-surfaces.ts` (nuevo)
- `src/core/cache/revalidate-prescription-surfaces.ts` / `revalidate-clinical.ts`
- `src/lib/actions/appointments.ts` / `waiting-room.ts` / `refeps.ts` / `settings.ts`
- `src/lib/actions/professional-signatures.ts` / `clinical-templates.ts` / `clinical-reset.ts` / `demo-data.ts` / `professional-intake.ts`
- `src/features/historias/actions/clinical-records.ts`
- `src/features/recetas/actions/prescription-templates.ts` / `coverage-rules.ts`
- `src/features/pacientes/actions/patient-attachments.ts` / `patient-chart-indicators.ts`
- `src/features/turnos/actions/create-turno-wizard.ts` / `reschedule-appointment.ts` / `turnos-config.ts`
- Tests: `revalidate-appointment-surfaces` / `revalidate-prescription-surfaces`

### Fase 4 (UX pending)

- `src/components/ui/button.tsx` (`pendingLabel` + `aria-busy`)
- Consulta/EHR/DrApp save buttons
- Paciente alta/edición/indicadores/baja
- Receta dispensada / REFEPS / anular orden
- Turnos wizard / config / lista de espera / sala
- PAMI guardar planilla
- Tests: `ui-button-pending.test.tsx`

### Fase 5 (HC first paint)

- `src/features/pacientes/server/patient-workspace-fetch-plan.ts`
- `src/features/pacientes/server/load-patient-workspace-page.ts`
- `src/features/pacientes/server/load-patient-ehr-data.ts`
- `src/features/historias/components/historias/patient-ehr-sidebar.tsx` (“Ver anteriores”)
- Tests: `tests/performance/progressive-loading.test.ts`

### Fase 6 (lista `/pacientes`)

- `src/core/supabase/pagination.ts` (`PATIENT_LIST_ID_IN_LIMIT`)
- `src/features/pacientes/utils/patient-search.ts`
- `src/features/pacientes/server/load-pacientes-page.ts`
- `src/features/pacientes/server/search-patients.ts`
- `src/lib/server/load-patient-picker-list.ts` (offset SQL, sin slice client)
- Tests: `pathology-search-rpc.test.ts` / `progressive-loading.test.ts`

### Fase 7 (`select("*")`)

- `src/features/pacientes/repositories/patients.repository.ts`
- `src/features/recetas/repositories/prescription-drafts.repository.ts`
- `src/features/recetas/repositories/medical-orders.repository.ts`
- `src/lib/actions/appointments.ts`
- `src/features/pacientes/server/load-patient-workspace-page.ts`
- `src/features/historias/server/load-historia-detail-page.ts`
- Tests: `tests/performance/no-select-star.test.ts`
