# DrFlow — Auditoría y optimización de base de datos

**Fecha:** 2026-08-10  
**Alcance:** PostgreSQL/Supabase — 54 tablas, 89 migraciones, ~350 consultas PostgREST/RPC en `src/`  
**Entregable migración:** `088_database_audit_indexes.sql`  
**Estado previo:** `061` (índices generales), `064` (RPCs agregación), `087` (búsqueda pacientes RPC)

---

## Resumen ejecutivo

| Categoría | Hallazgos | Acción |
|-----------|-----------|--------|
| Índices faltantes (hot paths) | 6 consultas frecuentes sin índice ideal | **088** — 6 índices targeted |
| `SELECT *` en loaders | 12 archivos (18+ ocurrencias) | 4 corregidos en este PR |
| N+1 queries | Mayoría resueltas en 064 | 5 pipelines import pendientes |
| Búsqueda pacientes | Resuelta en 087 | RPC + trgm + DNI |
| RLS / multiclinica | OK — índices lead con `clinic_id` | Verificado |
| RPC duplicados | No críticos | Centralización gradual |

**Impacto esperado:** −40–80% latencia en listado PAMI, búsqueda por patología, vademecum ILIKE y turnos próximos; −30% payload en recordatorios/telemedicina/cierre caja.

---

## 1. Inventario de tablas críticas

### `patients` (8 índices + UNIQUE documento)

| Relación | FK |
|----------|-----|
| Padre | `clinic_id → clinics`, `user_id → profiles` |
| Hijos | appointments, clinical_records, payments, prescription_drafts, medical_orders, caja, PAMI planillas |

**Consultas reales:**
- `/pacientes` — paginado `(clinic_id, is_active)` + ORDER BY last_name → `idx_patients_clinic_active_lastname`
- Búsqueda texto — ILIKE/trgm → `061` + `087` RPC
- PAMI — `insurance_provider ILIKE '%PAMI%'` → **nuevo** `idx_patients_clinic_pami_active`

**RLS:** `clinic_id IN user_clinic_ids()` — índices con prefijo `clinic_id` respetan aislamiento.

---

### `appointments` (9+ índices)

| Consulta | Índice usado / nuevo |
|----------|---------------------|
| Agenda calendario | `idx_appointments_clinic_start` |
| Dashboard hoy | `idx_appointments_clinic_prof_start` |
| Recordatorios / telemedicina próximos | **nuevo** `idx_appointments_clinic_upcoming_active` |
| Workspace paciente | `idx_appointments_clinic_patient_status_start` |

**Sin índice en:** `insurance_provider_snapshot` (solo display, no filtrado).

---

### `clinical_records` (4 índices + 2 trgm nuevos)

| Consulta | Antes | Después |
|----------|-------|---------|
| Listado clínica ORDER BY created_at | `idx_clinical_records_clinic_created` | = |
| Workspace paciente | `idx_clinical_records_clinic_patient_created` | = |
| Búsqueda patología (diagnosis/chief_complaint ILIKE) | **Seq Scan** en tokens | **GIN trgm** × 2 |

**Optimización app:** `load-historias-page.ts` usa `searchPatientsForClinic` RPC para resolver pacientes por nombre antes de filtrar registros.

---

### `professionals` (2 índices)

Roster por clínica: `idx_professionals_clinic_active_name`. Sin cambios — consultas cacheadas en `cached-clinic-queries`.

---

### `clinics` (root tenant)

~40 FK entrantes. Sin índice adicional (tabla pequeña, seq scan aceptable).

---

### Insurance / PAMI

| Recurso | Patrón | Índice |
|---------|--------|--------|
| `patients.insurance_provider` | ILIKE PAMI | `idx_patients_clinic_pami_active` |
| `pami_vademecum` | ILIKE brand/ingredient | B-tree existente + **trgm** nuevos |
| `pami_planilla_*` | slug/category | 079 — OK |
| `search_patients_for_clinic(p_pami_only)` | ILIKE PAMI | beneficia índice parcial PAMI |

---

## 2. Problemas encontrados

### P0 — Hot paths sin índice adecuado (corregidos en 088)

1. **Listado PAMI** (`load-pami-planillas-page.ts`): filtro `insurance_provider ILIKE '%PAMI%'` + ORDER BY apellido sin índice parcial.
2. **Búsqueda patología** (`findPatientIdsByPathologySearch`): ILIKE en `diagnosis`/`chief_complaint` sin trgm.
3. **Vademecum PAMI** (`search_pami_vademecum`): ILIKE en brand/ingredient — solo B-tree prefix.
4. **Turnos próximos** (`recordatorios`, `telemedicina`): `(clinic_id, status IN pending/confirmed, start_at)`.

### P1 — `SELECT *` innecesario

| Archivo | Estado |
|---------|--------|
| `recordatorios/page.tsx` | ✅ columnas explícitas |
| `telemedicina/page.tsx` | ✅ columnas explícitas |
| `caja/cierre/page.tsx` | ✅ columnas explícitas |
| `pacientes/[id]/page.tsx` | Pendiente (EHR completo — justificado) |
| `historias/[id]/editar/page.tsx` | Pendiente |
| `repositories/*.ts` | Pendiente (abstracción genérica) |

### P1 — Consultas duplicadas de sesión

| Archivo | Estado |
|---------|--------|
| `recordatorios/page.tsx` | ✅ `getDashboardPageContext` |
| `telemedicina/page.tsx` | ✅ `getDashboardPageContext` |
| ~35 páginas restantes | Pendiente (migración gradual) |

### P2 — Sin impacto inmediato

- N+1 en imports masivos (5 pipelines) — requiere batch RPC
- `count_consultations_by_doctor` — RPC futuro
- `pg_stat_statements` no habilitado en repo — recomendado en Supabase dashboard
- Paginación ausente: `atenciones`, `datos` admin

---

## 3. Índices agregados (088)

| Índice | Tabla | Columnas | Predicado | Consulta objetivo |
|--------|-------|----------|-----------|-------------------|
| `idx_patients_clinic_pami_active` | patients | `(clinic_id, last_name, first_name)` | active + PAMI | Planillas PAMI, filtro cobertura |
| `idx_clinical_records_diagnosis_trgm` | clinical_records | GIN diagnosis | NOT NULL | Patología ILIKE |
| `idx_clinical_records_chief_complaint_trgm` | clinical_records | GIN chief_complaint | NOT NULL | Motivo consulta ILIKE |
| `idx_pami_vademecum_brand_trgm` | pami_vademecum | GIN brand_name | active | search_pami_vademecum |
| `idx_pami_vademecum_ingredient_trgm` | pami_vademecum | GIN active_ingredient | active | search_pami_vademecum |
| `idx_appointments_clinic_upcoming_active` | appointments | `(clinic_id, start_at)` | pending/confirmed | Recordatorios, telemedicina |

**No creados (evaluados y descartados):**
- Índice en `insurance_provider` global — cubierto por parcial PAMI + trgm búsqueda general
- Índice redundante en `reminder_logs` — ya existe `idx_reminder_logs_clinic_status_created` (061)
- Índice en `medical_orders` draft — ya existe `idx_medical_orders_clinic_draft_created` (061)

---

## 4. Consultas optimizadas (código)

| Archivo | Cambio |
|---------|--------|
| `load-historias-page.ts` | Búsqueda paciente vía RPC `searchPatientsForClinic` (reemplaza PostgREST ILIKE chain) |
| `recordatorios/page.tsx` | Columnas explícitas + 1 round-trip auth menos |
| `telemedicina/page.tsx` | Columnas explícitas + auth consolidado |
| `caja/cierre/page.tsx` | 10 columnas explícitas en closure |

---

## 5. EXPLAIN — validación recomendada

Ejecutar en staging/prod post-deploy:

```sql
-- PAMI roster
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM patients
WHERE clinic_id = '<uuid>' AND is_active AND insurance_provider ILIKE '%PAMI%'
ORDER BY last_name LIMIT 50;

-- Pathology token
EXPLAIN (ANALYZE, BUFFERS)
SELECT patient_id FROM clinical_records
WHERE clinic_id = '<uuid>'
  AND (diagnosis ILIKE '%diabetes%' OR chief_complaint ILIKE '%diabetes%');

-- Vademecum
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM search_pami_vademecum('losartán', 15);

-- Upcoming appointments
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM appointments
WHERE clinic_id = '<uuid>' AND status IN ('pending','confirmed')
  AND start_at >= now() ORDER BY start_at LIMIT 20;
```

Planes esperados: `Bitmap Index Scan` / `Index Scan` en lugar de `Seq Scan`.

---

## 6. RLS y multiclinica

Todos los índices nuevos en tablas tenant-scoped incluyen `clinic_id` como prefijo B-tree o filtran vía partial index acotado por clínica en la consulta app.

RPCs auditadas usan `SECURITY INVOKER` (087) o filtran `p_clinic_id` explícitamente. RLS policies en `002_rls_policies.sql` + hardening 045/053 no requieren cambios.

---

## 7. Impacto esperado

| Escenario | Antes (est.) | Después (est.) |
|-----------|--------------|----------------|
| Planillas PAMI (500 pacientes PAMI) | 80–200 ms seq scan | 15–40 ms index scan |
| Patología "diabetes" (12k registros) | 100–300 ms | 20–60 ms bitmap trgm |
| Vademecum ILIKE | 50–150 ms | 10–30 ms |
| Recordatorios turnos próximos | 30–80 ms | 5–20 ms |
| Payload recordatorios | ~2 KB/fila × 50 | ~0.5 KB/fila × 50 |

---

## 8. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Índices parciales PAMI no incluyen nuevos pacientes OS until insert | Predicado evaluado en INSERT/UPDATE — automático |
| Más índices = INSERT más lento en clinical_records | Partial WHERE NOT NULL limita tamaño |
| Migración 088 en prod grande | Usar `CREATE INDEX CONCURRENTLY` manual si >100k filas (088 usa IF NOT EXISTS estándar) |
| RPC 087 no aplicada | Búsqueda historias fallará — deploy 087 antes de 088 |

---

## 9. Backlog P3 (no incluido)

- Batch RPC `bulk_upsert_patients` / `bulk_insert_clinical_records`
- RPC `count_consultations_by_doctor`
- Habilitar `pg_stat_statements` + dashboard unused indexes
- Migrar ~35 páginas restantes a `getDashboardPageContext`
- trgm en `pami_vademecum.laboratory` / `presentation` si catálogo >10k filas

---

## Deploy

```
087_patient_search_optimization.sql  (si no aplicada)
088_database_audit_indexes.sql
```

Verificación:

```sql
SELECT indexname FROM pg_indexes
WHERE indexname LIKE 'idx_%pami%' OR indexname LIKE 'idx_clinical_records_%trgm%'
   OR indexname = 'idx_appointments_clinic_upcoming_active';
```
