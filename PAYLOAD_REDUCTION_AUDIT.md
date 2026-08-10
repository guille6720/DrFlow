# DrFlow — Reducción de payload (PROMPT 03)

**Fecha:** 2026-08-10  
**Enfoque:** Reemplazar `SELECT *` y relaciones amplias por listas explícitas en `select-columns.ts`.

---

## Resumen de cambios

| Área | Antes | Después | Ahorro est. |
|------|-------|---------|-------------|
| Paciente workspace/edit | `select("*")` (~24 cols) | `PATIENT_DETAIL_COLUMNS` (21 cols) | ~15% / fila |
| Secretaría documentos | `select("*")` | `PATIENT_ADMIN_COLUMNS` (11 cols) | ~55% / fila |
| Editar consulta (paciente) | `select("*")` | `PATIENT_CLINICAL_CONTEXT_COLUMNS` (6 cols) | ~75% / fila |
| Editar consulta (record) | `select("*")` | `CLINICAL_RECORD_EDIT_COLUMNS` (12 cols) | ~40% / fila |
| Recordatorio turno (action) | `appointments.*` (20 cols) | `APPOINTMENT_REMINDER_COLUMNS` (7 cols) | ~65% / fila |
| Telemedicina session | `select("*")` | `TELEMEDICINE_SESSION_LIST_COLUMNS` | ~15% / fila |
| Medical orders EHR | `select("*")` | `MEDICAL_ORDER_LIST_COLUMNS` | ~10% / fila |
| Profesionales full cache | `professionals.*` (~20 cols) | `PROFESSIONAL_PRESCRIBER_COLUMNS` | ~50% / fila |
| Recetas recientes | `prescription_drafts.*` | `PRESCRIPTION_RECENT_LIST_COLUMNS` | ~30% / fila |
| Booking público | `public_booking_links.*` | `PUBLIC_BOOKING_LINK_COLUMNS` | ~20% / fila |
| ARCO export | `select("*")` | `PATIENT_DETAIL_COLUMNS` | ~15% / fila |

**Estimación agregada por request típico:**
- `/pacientes/[id]`: ~200–400 B menos por carga (excluye `user_id`, `updated_at`)
- `sendReminder`: ~800 B menos por turno
- `loadPatientEhrData` orders (50 filas): ~2–4 KB menos

---

## Columnas centralizadas (`select-columns.ts`)

Nuevas constantes:
- `PATIENT_DETAIL_COLUMNS`, `PATIENT_ADMIN_COLUMNS`, `PATIENT_CLINICAL_CONTEXT_COLUMNS`
- `APPOINTMENT_REMINDER_COLUMNS`, `APPOINTMENT_TELEMEDICINE_COLUMNS`
- `PROFESSIONAL_PRESCRIBER_COLUMNS`
- `CLINICAL_RECORD_EDIT_COLUMNS`
- `MEDICAL_ORDER_LIST_COLUMNS`, `MEDICAL_ORDER_IDEMPOTENCY_COLUMNS`
- `PRESCRIPTION_RECENT_LIST_COLUMNS`
- `PUBLIC_BOOKING_LINK_COLUMNS`, `TELEMEDICINE_SESSION_LIST_COLUMNS`

---

## `SELECT *` restantes (justificados)

| Ubicación | Motivo |
|-----------|--------|
| `insert().select().single()` en repositories | Retorno post-mutación; necesita fila completa insertada |
| Loaders ya optimizados en 064/QUERY_OPTIMIZATION | Dashboard ops, historia detail, workspace page |

---

## Medición recomendada en staging

```sql
-- Comparar tamaño JSON aproximado
SELECT pg_column_size(row_to_json(p.*))
FROM patients p LIMIT 1;

SELECT pg_column_size(row_to_json(p))
FROM (
  SELECT id, first_name, last_name, document_number, phone, email
  FROM patients LIMIT 1
) p;
```

En DevTools → Network, comparar respuestas PostgREST de `/rest/v1/patients` antes/después del deploy.

---

## Riesgos

- Tipos TypeScript: casts a `Patient` donde el select es subconjunto intencional
- ARCO export: excluye `user_id`/`updated_at` (no relevantes para titular de datos)
- Edit consulta: paciente sin `document_number` en contexto — el form usa `record.patient_id` + datos clínicos solamente
