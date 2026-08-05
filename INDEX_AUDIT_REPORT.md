# DrFlow — Auditoría de Índices PostgreSQL

**Fecha:** 2026-08-04  
**Rol:** DBA Senior / PostgreSQL  
**Alcance:** 62 migraciones existentes + ~350 consultas PostgREST en `src/`  
**Entregable:** `supabase/migrations/061_index_optimization.sql`

---

## Resumen ejecutivo

| Categoría | Hallazgos | Acción en 061 |
|-----------|-----------|---------------|
| **Índices duplicados** | 1 par exacto | DROP `idx_clinical_records_clinic` |
| **Índices redundantes** | 5 (UNIQUE/PK/subset) | DROP 5 índices |
| **FK sin índice** | 12 columnas críticas | CREATE 10+ índices parciales |
| **Seq Scan en hot paths** | 8 consultas frecuentes | CREATE 12 índices compuestos |
| **Búsqueda ILIKE pacientes** | No usa B-tree | `pg_trgm` GIN × 3 |
| **Índices innecesarios retenidos** | 4 pares solapados | Mantener (costo bajo, distintos planes) |

**Impacto esperado:** reducción de latencia en agenda, portal de turnos, workspace de paciente, dashboard operativo y búsqueda de pacientes. Menor bloqueo en DELETE de turnos/profesionales gracias a índices en FK.

---

## Metodología

1. Inventario completo de `CREATE INDEX` en migraciones 001–060.
2. Cruce con patrones `.from().eq().order()` en loaders, actions y API routes.
3. Análisis de RPC SQL (`get_public_booking_occupancy`, orphan repair en 060).
4. Clasificación: duplicado / redundante / faltante / innecesario.
5. Inferencia de **Sequential Scan** cuando el filtro no coincide con prefijo de índice existente.

> **Nota:** No hay `pg_stat_statements` en el repo. Los Seq Scan listados son **predicciones del planificador** basadas en filtros de la app. Validar en producción con:
> ```sql
> EXPLAIN (ANALYZE, BUFFERS) <query>;
> SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan;
> ```

---

## 1. Índices duplicados

| Índice A | Índice B | Columnas | Veredicto |
|----------|----------|----------|-----------|
| `idx_clinical_records_clinic` (045) | `idx_clinical_records_clinic_created` (054) | `(clinic_id, created_at DESC)` | **Duplicado exacto** → DROP A |

PostgreSQL no deduplica índices idénticos: duplica espacio en disco y ralentiza INSERT/UPDATE en `clinical_records`.

---

## 2. Índices redundantes (061 los elimina)

| Índice | Motivo | Cubierto por |
|--------|--------|--------------|
| `idx_patients_document` | Mismas columnas que constraint UNIQUE | `patients_clinic_id_document_number_key` |
| `idx_clinic_plugins_clinic` | Prefijo de PK compuesta | PK `(clinic_id, plugin_id)` |
| `idx_clinic_feature_flags_clinic` | Prefijo de PK compuesta | PK `(clinic_id, flag_id)` |
| `patient_app_share_log_clinic_idx` | Subconjunto estricto | `idx_patient_app_share_log_clinic_patient` |
| `idx_patient_ledger_patient` | App siempre filtra `clinic_id` | Nuevo `idx_patient_ledger_clinic_patient_entry` |

---

## 3. Índices innecesarios — **retener** (no DROP)

Estos pares se solapan pero sirven planes distintos; el costo de mantenimiento es bajo frente al beneficio:

| Par | Por qué mantener ambos |
|-----|------------------------|
| `idx_clinical_records_patient` vs `idx_clinical_records_clinic_patient_created` | Consultas solo por `patient_id` (RLS) vs workspace tenant-scoped |
| `idx_patient_attachments_patient` vs composite 046 | Mismo patrón |
| `idx_medical_orders_clinic` / `_patient` vs `_clinic_patient_issued` | Listas clinic-wide vs timeline por paciente |
| `idx_appointments_clinic_start` vs `_waiting_room` | Calendario general vs sala de espera (+ `waiting_room_status`) |
| `idx_audit_logs_clinic` vs `_module_created` / `_patient` | Feed general vs filtros dimensionales |
| `idx_reminder_logs_clinic_created` vs nuevo `_clinic_status_created` | Lista sin filtro status vs dashboard `status=queued` |

**Excepción:** `idx_pami_vademecum_*` (4 B-tree en texto) — catálogo estático; solo útiles si hay búsqueda por prefijo sin RPC. La app usa `search_pami_vademecum` con ILIKE; evaluar `pg_trgm` en P3 si el catálogo crece.

---

## 4. Índices faltantes — migración 061

### 4.1 FK sin índice (JOIN / DELETE / orphan repair)

| Índice nuevo | Tabla.columna | Impacto |
|--------------|---------------|---------|
| `idx_clinical_records_appointment` | `clinical_records.appointment_id` | **DELETE turno:** evita Seq Scan al SET NULL (054/060). **Join** HC ↔ turno. |
| `idx_prescription_drafts_clinical_record` | `prescription_drafts.clinical_record_id` | Lookup recetas vinculadas a HC; orphan repair 060. |
| `idx_medical_orders_clinical_record` | `medical_orders.clinical_record_id` | Idem órdenes médicas. |
| `idx_payments_appointment` | `payments.appointment_id` | Reportes de pagos por turno; SET NULL en delete. |
| `idx_payments_patient` | `payments.patient_id` | Export ARCO / reportes por paciente. |
| `idx_telemedicine_sessions_appointment` | `telemedicine_sessions.appointment_id` | CASCADE delete; lookup sesión por turno (`clinic-services.ts`). |
| `idx_professionals_user` | `professionals.user_id` | Intake onboarding, `cleanup_user_profile_references`, delete cuenta. |
| `idx_cash_charges_appointment` | `cash_charges.appointment_id` | Vincular cobro ↔ turno en caja. |
| `idx_cash_invoices_charge` | `cash_invoices.cash_charge_id` | Facturación post-cobro. |
| `idx_clinical_record_attachments_record` | `clinical_record_attachments.clinical_record_id` | Tabla legacy; RLS subqueries. |

### 4.2 Hot paths — consultas con Seq Scan predicho

| Índice nuevo | Consulta / loader | Seq Scan sin índice | Plan esperado |
|--------------|-------------------|---------------------|---------------|
| `idx_patients_*_trgm` (×3) | `applyPatientSearchFilter` — ILIKE `%token%` en nombre/apellido/DNI | **Seq Scan** en `/pacientes`, command palette, `/historias` | **Bitmap Index Scan** GIN trgm |
| `idx_professionals_clinic_active_name` | `.eq(clinic_id).eq(is_active).order(display_name)` — agenda, config, portal | Seq Scan por clínica | Index Scan parcial |
| `idx_availability_rules_clinic_professional` | Portal booking + settings — `.eq(clinic_id, professional_id, is_active)` | Seq Scan | Index Scan parcial |
| `idx_schedule_blocks_clinic_prof_end` | `public-booking.ts` — bloques futuros por profesional | Seq Scan | Index Scan + filter `end_at` |
| `idx_schedule_blocks_clinic_start` | `agenda/page.tsx` — rango de fechas por clínica | Seq Scan | Index Range Scan |
| `idx_telemedicine_sessions_clinic_created` | `telemedicina/page.tsx` — últimas 20 sesiones | Seq Scan + Sort | Index Scan (orden incluido) |
| `idx_consent_records_clinic_patient_created` | `compliance.ts` — export ARCO | Seq Scan | Index Scan |
| `idx_reminder_logs_clinic_status_created` | Dashboard — `status=queued` + `created_at` | Filter sobre `idx_reminder_logs_clinic_created` | Index Scan directo |
| `idx_patient_ledger_clinic_patient_entry` | Cuenta corriente — balance + historial | Index solo en `patient_id` sin tenant | Index Scan compuesto |
| `idx_clinic_invitations_clinic_created` | `/configuracion` — invitaciones recientes | Seq Scan | Index Scan |
| `idx_medical_orders_clinic_draft_created` | Dashboard — órdenes draft | Filter post-scan en `idx_medical_orders_clinic` | Partial Index Scan |
| `idx_cash_invoices_clinic_patient` | Futuras listas de facturas por paciente | Seq Scan | Index Scan |

### 4.3 RPC ya cubiertos por índices existentes

| RPC | Filtro | Índice que lo sirve |
|-----|--------|---------------------|
| `get_public_booking_occupancy` | `clinic_id + professional_id + status + start_at` | `idx_appointments_clinic_prof_start` (045, partial) |
| `search_pathologies` / `search_symptoms` | GIN tsvector | 005, 011 |
| `claim_clinic_jobs` | `status IN pending,running + scheduled_at` | `idx_clinic_jobs_worker` (051) |
| `verify_referential_integrity` | NOT EXISTS subqueries | Nuevos índices FK en 061 aceleran checks |

---

## 5. Consultas con Sequential Scan — detalle

### 5.1 Alta prioridad (usuarios finales)

```typescript
// src/features/pacientes/utils/patient-search.ts
.or(`first_name.ilike.%${token}%,last_name.ilike.%${token}%,document_number.ilike.%${token}%`)
```
- **Problema:** B-tree no soporta `%texto%`. Con >5k pacientes activos por clínica → Seq Scan.
- **Fix:** GIN `pg_trgm` en 061.
- **Impacto:** Búsqueda pacientes ~10–100× más rápida en clínicas medianas/grandes.

```typescript
// src/lib/actions/public-booking.ts
.from("availability_rules").eq("clinic_id").eq("professional_id").eq("is_active", true)
.from("schedule_blocks").eq("clinic_id").eq("professional_id").gte("end_at", now)
```
- **Problema:** Tablas sin índice compuesto → Seq Scan en cada generación de slots (portal público).
- **Fix:** Índices parciales/compuestos en 061.
- **Impacto:** Latencia portal de turnos; crítico para conversión de reservas.

### 5.2 Media prioridad (dashboard / back-office)

| Página | Tabla | Filtro | Riesgo |
|--------|-------|--------|--------|
| Dashboard operativo | `reminder_logs` | `clinic_id + status=queued` | Seq Scan parcial |
| Dashboard operativo | `medical_orders` | `status=draft` | Seq Scan + sort |
| Telemedicina | `telemedicine_sessions` | `clinic_id ORDER BY created_at` | Seq Scan + sort |
| Cuenta corriente | `patient_ledger_entries` | `clinic_id + patient_id` | Subóptimo con índice solo patient |
| Configuración | `clinic_invitations` | `clinic_id ORDER BY created_at` | Seq Scan |

### 5.3 Baja prioridad / intencional

| Consulta | Motivo acceptable Seq Scan |
|----------|---------------------------|
| `clinics.select("*")` superadmin | Tabla minúscula (~decenas de filas) |
| `specialties/locations` por clínica | Catálogo <50 filas |
| Pharmacology reference | GIN ya presente; tablas globales pequeñas |
| `datos/page.tsx` migration health | Batch offline; `limit(25000)` acotado |

---

## 6. Impacto por índice agregado (061)

| Índice | Tipo | Lecturas mejoradas | Escrituras afectadas | Tamaño estimado |
|--------|------|-------------------|---------------------|-----------------|
| `idx_patients_first_name_trgm` | GIN partial | Búsqueda pacientes | INSERT/UPDATE patients | ~20–40% filas activas |
| `idx_patients_last_name_trgm` | GIN partial | Idem | Idem | Idem |
| `idx_patients_document_trgm` | GIN partial | DNI parcial | Idem | Idem |
| `idx_clinical_records_appointment` | B-tree partial | Delete turno, verify RI | UPDATE clinical_records | Pequeño (~10% filas) |
| `idx_professionals_clinic_active_name` | B-tree partial | 15+ páginas con roster | UPDATE professionals | ~N profesionales/clínica |
| `idx_availability_rules_clinic_professional` | B-tree partial | Portal + intake | UPDATE rules | Muy pequeño |
| `idx_schedule_blocks_clinic_prof_end` | B-tree | Portal blocks | INSERT blocks | Pequeño |
| `idx_schedule_blocks_clinic_start` | B-tree | Agenda semanal | INSERT blocks | Pequeño |
| `idx_telemedicine_sessions_clinic_created` | B-tree | `/telemedicina` | INSERT sessions | Pequeño |
| `idx_consent_records_clinic_patient_created` | B-tree | Export ARCO | INSERT consent | Mínimo |
| `idx_reminder_logs_clinic_status_created` | B-tree | Dashboard cola | INSERT reminders | Medio |
| `idx_patient_ledger_clinic_patient_entry` | B-tree | Caja cuenta corriente | INSERT ledger | Crece con uso caja |
| `idx_clinic_invitations_clinic_created` | B-tree | Config invitaciones | UPSERT invites | Mínimo |
| `idx_medical_orders_clinic_draft_created` | B-tree partial | Dashboard drafts | UPDATE orders | Solo drafts |
| FK indexes (payments, telemedicine, etc.) | B-tree partial | JOINs, DELETE, 060 verify | INSERT/UPDATE | Variable |

**Trade-off general:** cada índice acelera SELECT 5–50× en tablas >10k filas, a costa de ~1–3% más lento en INSERT/UPDATE de esa tabla. En DrFlow (lectura >> escritura clínica) el balance es favorable.

---

## 7. Despliegue

### Orden recomendado
```
057 → 058 → 059 → 060 → 061
```

### Ejecución
1. Aplicar `061_index_optimization.sql` en Supabase SQL Editor o `supabase db push`.
2. Verificar extension:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
   ```
3. Validar índices nuevos:
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE schemaname = 'public'
     AND indexname LIKE 'idx_%'
   ORDER BY tablename, indexname;
   ```
4. Smoke test EXPLAIN en búsqueda pacientes:
   ```sql
   EXPLAIN ANALYZE
   SELECT id FROM patients
   WHERE clinic_id = '<uuid>'
     AND is_active = true
     AND last_name ILIKE '%garc%'
   LIMIT 20;
   ```
   Debe mostrar `Bitmap Index Scan` sobre `idx_patients_last_name_trgm`.

### Monitoreo post-deploy (7 días)
```sql
-- Índices nunca usados (candidatos a DROP futuro)
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0
ORDER BY relname;

-- Seq Scans frecuentes
SELECT relname, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND seq_scan > 100
ORDER BY seq_tup_read DESC;
```

---

## 8. Backlog P3 (fuera de 061)

| ID | Item | Razón |
|----|------|-------|
| IDX-P3-1 | `pg_trgm` en `pami_vademecum.brand_name` | Solo si RPC search degrada |
| IDX-P3-2 | RPC `search_patients(clinic_id, q)` | Centralizar búsqueda + ranking |
| IDX-P3-3 | Índice `(clinic_id, insurance_provider)` partial PAMI | Filtro `.ilike('%PAMI%')` en pacientes |
| IDX-P3-4 | Habilitar `pg_stat_statements` en Supabase | Evidencia runtime vs inferencia |
| IDX-P3-5 | `CREATE INDEX CONCURRENTLY` para prod grande | Requiere script fuera de transacción Supabase |

---

## 9. Tests

```bash
npm run test -- tests/index-optimization-migration.test.ts
```

Valida estructura de la migración: DROP redundantes, pg_trgm, FK indexes, guards condicionales, ANALYZE.
