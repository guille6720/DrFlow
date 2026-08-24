-- Phase 29 — Read-only preservation smoke (staging).
-- Confirms core tenant tables remain queryable (not wiped).
-- Does not prove historical counts; operators should snapshot before apply.

SELECT
  (SELECT COUNT(*) FROM clinics) AS clinics_count,
  (SELECT COUNT(*) FROM patients) AS patients_count,
  (SELECT COUNT(*) FROM clinical_records) AS clinical_records_count,
  (SELECT COUNT(*) FROM clinic_subscriptions) AS subscriptions_count,
  (SELECT COUNT(*) FROM clinic_members) AS clinic_members_count;
