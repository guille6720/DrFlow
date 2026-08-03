SELECT
  to_regclass('public.patient_clinical_profiles') IS NOT NULL AS has_clinical_profiles,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'clinic_subscription_active') AS has_trial_fn,
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clinical_records_clinic_patient_created') AS has_perf_index;
