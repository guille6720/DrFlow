-- DrFlow release 0.2.19 — PRODUCTION verify (read-only)
-- Target: nipqdarduknydqptqzup
-- Paste in Supabase SQL Editor. All rows should show ok = true.

-- 1) Registered migrations
SELECT
  v.version AS expected,
  (sm.version IS NOT NULL) AS registered
FROM (VALUES
  ('112'), ('140'), ('141'), ('142'), ('143'), ('144'),
  ('20260826114420'), ('20260826114605'), ('20260826114630'),
  ('20260826120601'), ('20260826120735'), ('20260826120822'),
  ('20260826123241'), ('20260826123459'), ('20260826123700'),
  ('20260826140000'), ('20260826151000')
) AS v(version)
LEFT JOIN supabase_migrations.schema_migrations sm ON sm.version = v.version
ORDER BY v.version;

-- 2) Schema + catalog summary (single row)
SELECT
  has_function_privilege('authenticated', 'search_clinical_diagnoses(text, integer)', 'EXECUTE') AS rpc_exec,
  (SELECT count(*)::int FROM clinical_diagnoses WHERE active = true) AS diagnoses_active,
  (SELECT count(*)::int FROM clinical_diagnoses WHERE source = 'cie10-es-lista-tabular-enfermedades-pdf') AS cie10_rows,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clinical_diagnoses' AND column_name='source') AS has_source_col,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='professionals' AND column_name='cuil') AS renapdis_phase1,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' AND column_name='cuir_formatted') AS renapdis_phase2,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clinics' AND column_name='is_fiscalization') AS renapdis_phase3,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='validate_patient_portal_session_v2') AS portal_phase6;

-- Expected:
--   rpc_exec = true
--   cie10_rows >= 600 (after import; 0 is OK if only SQL applied, import pending)
--   all EXISTS columns = true
