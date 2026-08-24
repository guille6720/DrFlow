-- Verify migration 061_index_optimization.sql
-- Run AFTER applying 061 in Supabase SQL Editor.
-- Safe read-only checks + EXPLAIN ANALYZE on hot paths.

-- =============================================================================
-- 1. Extension pg_trgm
-- =============================================================================
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_trgm';

-- =============================================================================
-- 2. Indexes dropped (should return 0 rows each)
-- =============================================================================
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_clinical_records_clinic',
    'idx_patients_document',
    'idx_clinic_plugins_clinic',
    'idx_clinic_feature_flags_clinic',
    'patient_app_share_log_clinic_idx',
    'idx_patient_ledger_patient'
  );

-- =============================================================================
-- 3. Indexes created (should return 1 row each)
-- =============================================================================
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_patients_first_name_trgm',
    'idx_patients_last_name_trgm',
    'idx_patients_document_trgm',
    'idx_clinical_records_appointment',
    'idx_prescription_drafts_clinical_record',
    'idx_medical_orders_clinical_record',
    'idx_payments_appointment',
    'idx_payments_patient',
    'idx_telemedicine_sessions_appointment',
    'idx_professionals_user',
    'idx_professionals_clinic_active_name',
    'idx_availability_rules_clinic_professional',
    'idx_schedule_blocks_clinic_prof_end',
    'idx_schedule_blocks_clinic_start',
    'idx_telemedicine_sessions_clinic_created',
    'idx_consent_records_clinic_patient_created',
    'idx_reminder_logs_clinic_status_created',
    'idx_patient_ledger_clinic_patient_entry',
    'idx_clinic_invitations_clinic_created',
    'idx_medical_orders_clinic_draft_created',
    'idx_cash_charges_appointment',
    'idx_cash_invoices_clinic_patient',
    'idx_cash_invoices_charge',
    'idx_clinical_record_attachments_record'
  )
ORDER BY tablename, indexname;

-- =============================================================================
-- 4. Sample tenant context (first clinic with patients)
-- =============================================================================
SELECT
  c.id AS clinic_id,
  c.name AS clinic_name,
  (SELECT count(*) FROM patients p WHERE p.clinic_id = c.id AND p.is_active) AS active_patients
FROM clinics c
WHERE EXISTS (
  SELECT 1 FROM patients p WHERE p.clinic_id = c.id AND p.is_active LIMIT 1
)
ORDER BY active_patients DESC
LIMIT 1;

-- =============================================================================
-- 5. EXPLAIN ANALYZE — hot paths (uses sample clinic above)
--    Expected: Index Scan / Bitmap Index Scan, NOT Seq Scan on large tables
-- =============================================================================

-- 5a. Patient search (pacientes, command palette, historias)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, first_name, last_name, document_number
FROM patients
WHERE clinic_id = (
    SELECT c.id FROM clinics c
    WHERE EXISTS (SELECT 1 FROM patients p WHERE p.clinic_id = c.id AND p.is_active)
    ORDER BY (SELECT count(*) FROM patients p2 WHERE p2.clinic_id = c.id) DESC
    LIMIT 1
  )
  AND is_active = true
  AND (
    first_name ILIKE '%gar%'
    OR last_name ILIKE '%gar%'
    OR document_number ILIKE '%gar%'
  )
LIMIT 20;

-- 5b. Professionals roster (agenda, config, portal)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, display_name
FROM professionals
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
  AND is_active = true
ORDER BY display_name;

-- 5c. Public booking — availability rules
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT day_of_week, start_time, end_time, slot_duration
FROM availability_rules
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
  AND professional_id = (
    SELECT id FROM professionals
    WHERE clinic_id = (SELECT id FROM clinics LIMIT 1) AND is_active = true
    LIMIT 1
  )
  AND is_active = true;

-- 5d. Public booking — schedule blocks (future)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT start_at, end_at
FROM schedule_blocks
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
  AND professional_id = (
    SELECT id FROM professionals
    WHERE clinic_id = (SELECT id FROM clinics LIMIT 1) AND is_active = true
    LIMIT 1
  )
  AND end_at >= now();

-- 5e. Agenda — blocks in date range
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT start_at, end_at, reason
FROM schedule_blocks
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
  AND start_at >= date_trunc('week', now())
  AND start_at <= date_trunc('week', now()) + interval '7 days';

-- 5f. Telemedicina — recent sessions
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, appointment_id, status, created_at
FROM telemedicine_sessions
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
ORDER BY created_at DESC
LIMIT 20;

-- 5g. Dashboard — queued reminders today
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, appointment_id, channel, created_at
FROM reminder_logs
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
  AND status = 'queued'
  AND created_at >= date_trunc('day', now())
ORDER BY created_at DESC
LIMIT 8;

-- 5h. Dashboard — draft medical orders
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, order_text, patient_id, created_at
FROM medical_orders
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
  AND status = 'draft'
ORDER BY created_at DESC
LIMIT 8;

-- 5i. Clinical records — clinic timeline (/historias)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, patient_id, created_at
FROM clinical_records
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
ORDER BY created_at DESC
LIMIT 25;

-- 5j. Patient workspace — records by patient
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, created_at
FROM clinical_records
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
  AND patient_id = (
    SELECT id FROM patients
    WHERE clinic_id = (SELECT id FROM clinics LIMIT 1) AND is_active = true
    LIMIT 1
  )
ORDER BY created_at DESC
LIMIT 50;

-- 5k. Caja — ledger balance lookup (skip if 034 not applied)
DO $$
BEGIN
  IF to_regclass('public.patient_ledger_entries') IS NOT NULL THEN
    RAISE NOTICE 'Running EXPLAIN on patient_ledger_entries...';
    EXECUTE $sql$
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT balance_after
      FROM patient_ledger_entries
      WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
        AND patient_id = (
          SELECT id FROM patients
          WHERE clinic_id = (SELECT id FROM clinics LIMIT 1) AND is_active = true
          LIMIT 1
        )
      ORDER BY entry_at DESC
      LIMIT 1
    $sql$;
  ELSE
    RAISE NOTICE 'SKIP 5k: patient_ledger_entries not present (migration 034)';
  END IF;
END $$;

-- 5l. RPC get_public_booking_occupancy (portal slots)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT start_at, end_at
FROM get_public_booking_occupancy(
  (SELECT slug FROM public_booking_links WHERE is_active = true LIMIT 1),
  (SELECT id FROM professionals WHERE is_active = true LIMIT 1)
);

-- =============================================================================
-- 6. Index usage stats (run 7 days post-deploy; idx_scan = 0 → review)
-- =============================================================================
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan,
  idx_tup_read,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE 'idx_%'
ORDER BY idx_scan DESC, relname
LIMIT 40;

-- =============================================================================
-- 8. Fase 8 — indexes from 046 / 054 / 013 / 001 / 088 (must exist; do NOT recreate)
-- =============================================================================
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_clinical_records_clinic_patient_created',
    'idx_clinical_records_clinic_created',
    'idx_patient_attachments_clinic_patient_created',
    'idx_prescription_drafts_clinic_patient_status_issued',
    'idx_prescription_drafts_clinic_status',
    'idx_medical_orders_clinic_patient_issued',
    'idx_appointments_clinic_patient_status_start',
    'idx_appointments_status',
    'idx_appointments_clinic_upcoming_active',
    'idx_patients_clinic_active_lastname',
    'idx_ppl_clinic_patient_status'
  )
ORDER BY tablename, indexname;

-- 8a. Workspace SOAP — last N evolutions
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, created_at
FROM clinical_records
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
  AND patient_id = (
    SELECT id FROM patients
    WHERE clinic_id = (SELECT id FROM clinics LIMIT 1) AND is_active = true
    LIMIT 1
  )
ORDER BY created_at DESC
LIMIT 20;

-- 8b. Agenda / dashboard — clinic + status
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, start_at, status
FROM appointments
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
  AND status IN ('pending', 'confirmed')
ORDER BY start_at
LIMIT 50;

-- 8c. Recetas workspace — clinic + patient + status
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, status, issued_at
FROM prescription_drafts
WHERE clinic_id = (SELECT id FROM clinics LIMIT 1)
  AND patient_id = (
    SELECT id FROM patients
    WHERE clinic_id = (SELECT id FROM clinics LIMIT 1) AND is_active = true
    LIMIT 1
  )
ORDER BY issued_at DESC NULLS LAST
LIMIT 20;

-- =============================================================================
-- 9. Tables with high sequential scans (monitor weekly)
-- =============================================================================
SELECT
  relname AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup AS est_rows,
  CASE WHEN seq_scan + idx_scan > 0
    THEN round(100.0 * seq_scan / (seq_scan + idx_scan), 1)
    ELSE 0
  END AS seq_scan_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (seq_scan > 0 OR n_live_tup > 1000)
ORDER BY seq_tup_read DESC
LIMIT 20;
