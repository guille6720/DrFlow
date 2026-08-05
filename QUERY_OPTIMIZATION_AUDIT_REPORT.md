# Auditoría de consultas SQL / Supabase — DrFlow

**Fecha:** 2026-07-30  
**Alcance:** ~95 archivos con `.from()` / `.rpc()` en `src/`  
**Migración DB:** `064_query_optimization.sql` (RPCs de agregación)

---

## Resumen ejecutivo

| Anti-patrón detectado | Ocurrencias (antes) | Corregidas en este PR | Pendientes |
|----------------------|---------------------|----------------------|------------|
| N+1 en loops de import | 6 pipelines | 1 (PDF evoluciones) | 5 (requieren batch RPC) |
| `SELECT *` | 18+ | 12 | 6 |
| Fetch-all → count/sum en JS | 5 | 4 | 1 (`consultationsByDoctor`) |
| Consultas de sesión duplicadas | ~40 páginas | 4 páginas migradas a `getDashboardShell` | resto gradual |
| Paginación ausente | 8 páginas | 2 (`pagos`, `historias/nueva`) | 6 |
| JOIN / query duplicada | 3 | 3 | 0 |

---

## Métricas comparativas (clínica tipo: 800 pacientes, 12.000 consultas, 400 turnos/mes)

Estimaciones basadas en payload PostgREST (~150 B/fila consulta, ~80 B/fila count head, ~1 KB/fila paciente completo).

### 1. Conteo de consultas por paciente (`batchPatientRecordCounts`)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Query pattern | `SELECT patient_id` (todas las filas) | `RPC count_clinical_records_by_patients` GROUP BY | — |
| Filas transferidas (50 pacientes, ~15 consultas c/u) | **750 filas** | **≤50 filas JSON** | **−93%** |
| Bytes respuesta (~) | ~112 KB | ~2 KB | **−98%** |
| Tiempo DB (~) | 45–120 ms seq scan parcial | 8–25 ms index scan + hash agg | **−70%** |
| Round-trips | 1 | 1 | = |

**Archivo:** `src/lib/utils/batch-patient-record-counts.ts` + `064_query_optimization.sql`

---

### 2. Reportes operativos (`reportes/page.tsx`, `generate-report.ts`)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Turnos totales | Fetch 400 filas + join | `COUNT` head only | — |
| Ingresos estimados | Fetch N pagos + reduce JS | `RPC sum_paid_payments` | — |
| Filas transferidas (turnos) | **400** | **0** (solo count) | **−100%** |
| Filas transferidas (pagos, 80 pagos/mes) | **80** | **1 escalar** | **−99%** |
| Bytes respuesta turnos+pagos (~) | ~95 KB | ~200 B | **−99.8%** |
| Round-trips | 6 | 6 | = |

**Nota:** `consultationsByDoctor` sigue necesitando filas de `clinical_records` con join a profesional (agrupación por nombre). Optimización futura: RPC `count_consultations_by_doctor`.

---

### 3. Sesión / auth (`session.ts`)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| `getProfile` columnas | `*` (~12 cols + metadata) | 7 cols explícitas | **−40% payload** |
| `getUserClinics` superadmin | `clinics.*` | `CLINIC_COLUMNS` (18 cols) | sin cols internas extra |
| `getActiveClinic` queries profile | 2ª query `is_superadmin` | Reusa `getProfile()` cache | **−1 round-trip** |
| `getUserClinics` profile | Query propia | Reusa `getProfile()` | **−1 round-trip** cuando encadenado |

**Impacto por request dashboard (sin `getDashboardShell`):**  
Antes: 3–4 queries auth → Después: 2–3 (con cache React dedupe en paralelo: **−25% round-trips**).

---

### 4. Pagos (`pagos/page.tsx`)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Pacientes | `SELECT *` sin límite (**800 filas**) | `id, first_name, last_name` limit 500 | **−85% cols, cap 500** |
| Payments | `SELECT *` | 8 columnas explícitas | **−30% payload** |
| Auth round-trips | 4 (`getProfile`×…) | 1 (`getDashboardPageContext`) | **−75%** |
| Bytes pacientes (~) | ~800 KB | ~40 KB | **−95%** |

---

### 5. Auditoría de paciente (`load-patient-audit-trail.ts`)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Prefetch record IDs | `SELECT id` **sin límite** (ej. 2.000 UUIDs) | Eliminado | **−1 query** |
| `clinical_record_audit` | `.in(clinical_record_id, [...2000])` | `.eq(patient_id)` (índice `idx_clinical_record_audit_patient`) | **−URL size, usa índice** |
| `audit_logs` filter | 3 OR incl. `.in()` masivo | `patient_id` OR `entity_id` = paciente | **−N UUIDs en URL** |
| Bytes prefetch (~) | ~72 KB solo IDs | 0 | **−100%** |

---

### 6. Import PDF evoluciones (`clinical-pdf-import.ts`)

| Métrica | Antes (50 evoluciones) | Después | Δ |
|---------|------------------------|---------|---|
| Query profesionales | **50×** (1 por iteración) | **1×** antes del loop | **−98% queries** |
| Round-trips extra | 49 | 0 | **−49 RTT** |
| Tiempo import (~) | 50×40ms = 2s solo pros | 1×40ms | **−97%** |

---

### 7. Detalle historia clínica (`load-historia-detail-page.ts`)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Portal doctor info | 2 queries secuenciales | 1 (`getPortalContextForClinic`) | **−50% RTT** |
| `prescription_drafts` | `SELECT *` | 7 columnas | **−50% payload** |
| `medical_orders` | `SELECT *` | 9 columnas | **−40% payload** |
| `clinical_record_audit` | `SELECT *` | 4 columnas + join profile | **−60% payload** |

---

### 8. Agenda (`agenda/page.tsx`)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Appointments cols | `*` (16+ cols) | 16 cols explícitas (sin metadata PG) | **≈ −15% payload** |
| Professionals cols | `*` (20+ cols) | 11 cols + joins | **−45% payload** |
| Turnos en ventana 37d (~180) | ~180 KB | ~150 KB | **−17%** |

---

### 9. Portal pacientes (`portal/[slug]/page.tsx`)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Booking link queries | 2 (page + `resolvePortalDoctorInfo`) | 1 | **−50%** |
| `public_booking_links` cols | `*` | 2 + nested clinic cols | **−30%** |

---

### 10. Revenue snapshot / caja (`load-revenue-snapshot.ts`)

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Cargos del mes | Todas las filas + filter JS `status=collected` | `RPC sum_collected_cash_charges` o filter SQL | **−95% filas mes** |
| Cargos del día (breakdown) | Sin filter status en SQL | `.eq('status','collected')` | **−voided rows** |
| Bytes mes (500 cargos) (~) | ~75 KB | ~50 B | **−99.9%** (con RPC) |

---

## Hallazgos no corregidos (backlog)

### N+1 crítico — imports batch
Requieren RPC batch o staging table:

| Archivo | Patrón | Impacto estimado |
|---------|--------|------------------|
| `clinical-import.ts` | 3–5 queries × fila CSV | 100 filas = **300–500 queries** |
| `hce-import-batch.ts` | patient resolve + insert/row | 80 filas/batch = **160–400 queries** |
| `teams-jsonl-import.ts` | idem HCE | idem |
| `consumers-import-batch.ts` | findOrCreate + merge/row | **160–320 queries**/batch |

**Recomendación:** RPC `bulk_upsert_patients` + `bulk_insert_clinical_records` con UNNEST.

### Páginas sin límite
| Página | Query | Riesgo |
|--------|-------|--------|
| `atenciones/page.tsx` | appointments periodo completo | O(n) turnos |
| `pami/planillas/page.tsx` | todos los pacientes | O(n) pacientes |
| `datos/page.tsx` | migración health check | admin only |

### `SELECT *` restante
`recordatorios/page.tsx`, `caja/cierre/page.tsx`, `compliance.ts`, repositorios (`patients.repository`, `clinical-records.repository`).

---

## RPCs nuevos (064)

```sql
count_clinical_records_by_patients(clinic_id, patient_ids[]) → [{patient_id, count}]
sum_collected_cash_charges(clinic_id, from, to) → {total, charge_count}
sum_paid_payments(clinic_id, from, to) → numeric
```

Todos con fallback en TypeScript si la migración aún no está aplicada.

---

## Archivos modificados

| Archivo | Optimización |
|---------|-------------|
| `064_query_optimization.sql` | RPCs agregación |
| `batch-patient-record-counts.ts` | RPC + fallback |
| `select-columns.ts` | Column lists compartidos |
| `session.ts` | Column pruning + dedupe profile |
| `pagos/page.tsx` | Shell + cols + limit |
| `reportes/page.tsx` | COUNT + RPC sum |
| `generate-report.ts` | idem reportes |
| `load-revenue-snapshot.ts` | RPC mes + filter SQL |
| `load-patient-audit-trail.ts` | patient_id index path |
| `clinical-pdf-import.ts` | Cache profesionales |
| `historias/nueva/page.tsx` | cols + limit 500 |
| `agenda/page.tsx` | cols explícitas |
| `load-historia-detail-page.ts` | portal 1-RT + cols |
| `load-patient-workspace-page.ts` | medical_orders cols |
| `portal/[slug]/page.tsx` | dedupe booking link |
| `portal-doctor-info.ts` | export helper |

---

## Cómo validar en producción

1. Aplicar `064_query_optimization.sql` en Supabase.
2. En logs PostgREST / Dashboard → Database → Query performance:
   - Verificar uso de `count_clinical_records_by_patients` vs seq scan en `clinical_records`.
3. Comparar tamaño de respuesta en Network tab:
   - `/pagos` → payload pacientes debe bajar de MB a KB.
   - `/reportes` → sin array de appointments en response JSON.

---

## Orden de despliegue

```
063 (atomic ops) → 064 (query RPCs) → deploy app
```

La app funciona sin 064 gracias a fallbacks; con 064 activo se obtienen las métricas máximas.
