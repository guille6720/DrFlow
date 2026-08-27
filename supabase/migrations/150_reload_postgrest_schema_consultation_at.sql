-- Ensure PostgREST picks up update_clinical_record_consultation_at (migration 149).
NOTIFY pgrst, 'reload schema';
