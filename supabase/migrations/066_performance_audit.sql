-- Performance audit: composite lookup on patient_clinical_profiles + cap-safe RPC note.

CREATE INDEX IF NOT EXISTS idx_patient_clinical_profiles_clinic_patient
  ON patient_clinical_profiles(clinic_id, patient_id);

COMMENT ON INDEX idx_patient_clinical_profiles_clinic_patient IS
  'Dashboard allergy/critical profile batch fetch (clinic_id + patient_id IN).';
