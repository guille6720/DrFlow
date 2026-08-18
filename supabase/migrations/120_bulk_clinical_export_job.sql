-- Phase 4 import/export: async bulk clinical export job type.
-- Reuses clinic_jobs + clinical-files export-staging. Does not alter PHI tables.

ALTER TABLE public.clinic_jobs DROP CONSTRAINT IF EXISTS clinic_jobs_job_type_check;

ALTER TABLE public.clinic_jobs
  ADD CONSTRAINT clinic_jobs_job_type_check
  CHECK (job_type IN (
    'send_reminder',
    'send_email',
    'generate_report',
    'import_hce_batch',
    'import_patients_batch',
    'import_clinical_pdf',
    'run_ai_task',
    'export_clinical_bulk'
  ));
