-- Phase 10 security: isolate patient PHI, trial enforcement on clinical writes, re-assert helpers.

-- ---------------------------------------------------------------------------
-- Patient clinical PHI (secretary must NOT read via patients table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_clinical_profiles (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  medical_history TEXT,
  allergies TEXT,
  regular_medication TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_clinical_profiles_clinic
  ON patient_clinical_profiles(clinic_id);

ALTER TABLE patient_clinical_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_clinical_profiles_select ON patient_clinical_profiles;
CREATE POLICY patient_clinical_profiles_select ON patient_clinical_profiles FOR SELECT
  USING (is_superadmin() OR can_view_clinical(clinic_id));

DROP POLICY IF EXISTS patient_clinical_profiles_insert ON patient_clinical_profiles;
CREATE POLICY patient_clinical_profiles_insert ON patient_clinical_profiles FOR INSERT
  WITH CHECK (is_superadmin() OR can_view_clinical(clinic_id));

DROP POLICY IF EXISTS patient_clinical_profiles_update ON patient_clinical_profiles;
CREATE POLICY patient_clinical_profiles_update ON patient_clinical_profiles FOR UPDATE
  USING (is_superadmin() OR can_view_clinical(clinic_id));

DROP POLICY IF EXISTS patient_clinical_profiles_delete ON patient_clinical_profiles;
CREATE POLICY patient_clinical_profiles_delete ON patient_clinical_profiles FOR DELETE
  USING (is_superadmin() OR can_view_clinical(clinic_id));

INSERT INTO patient_clinical_profiles (patient_id, clinic_id, medical_history, allergies, regular_medication, notes)
SELECT id, clinic_id, medical_history, allergies, regular_medication, notes
FROM patients
WHERE COALESCE(medical_history, '') <> ''
   OR COALESCE(allergies, '') <> ''
   OR COALESCE(regular_medication, '') <> ''
   OR COALESCE(notes, '') <> ''
ON CONFLICT (patient_id) DO UPDATE SET
  medical_history = EXCLUDED.medical_history,
  allergies = EXCLUDED.allergies,
  regular_medication = EXCLUDED.regular_medication,
  notes = EXCLUDED.notes,
  updated_at = now();

UPDATE patients
SET medical_history = NULL,
    allergies = NULL,
    regular_medication = NULL,
    notes = NULL
WHERE medical_history IS NOT NULL
   OR allergies IS NOT NULL
   OR regular_medication IS NOT NULL
   OR notes IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Trial / subscription gate for clinical writes (defense in depth vs app middleware)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clinic_subscription_active(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM clinics c
    WHERE c.id = p_clinic_id
      AND (c.trial_ends_at IS NULL OR c.trial_ends_at > now())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_write_clinical(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_superadmin()
    OR (can_view_clinical(p_clinic_id) AND clinic_subscription_active(p_clinic_id));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS clinical_records_insert ON clinical_records;
CREATE POLICY clinical_records_insert ON clinical_records FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR (
      (is_doctor_in_clinic(clinic_id) OR user_role_in_clinic(clinic_id) = 'clinic_admin')
      AND clinic_subscription_active(clinic_id)
    )
  );

DROP POLICY IF EXISTS clinical_records_update ON clinical_records;
CREATE POLICY clinical_records_update ON clinical_records FOR UPDATE
  USING (
    is_superadmin()
    OR (
      (is_doctor_in_clinic(clinic_id) OR user_role_in_clinic(clinic_id) = 'clinic_admin')
      AND clinic_subscription_active(clinic_id)
    )
  );

DROP POLICY IF EXISTS prescription_drafts_all ON prescription_drafts;
CREATE POLICY prescription_drafts_select ON prescription_drafts FOR SELECT
  USING (is_superadmin() OR can_view_clinical(clinic_id));

CREATE POLICY prescription_drafts_insert ON prescription_drafts FOR INSERT
  WITH CHECK (is_superadmin() OR can_write_clinical(clinic_id));

CREATE POLICY prescription_drafts_update ON prescription_drafts FOR UPDATE
  USING (is_superadmin() OR can_write_clinical(clinic_id));

CREATE POLICY prescription_drafts_delete ON prescription_drafts FOR DELETE
  USING (is_superadmin() OR can_write_clinical(clinic_id));

DROP POLICY IF EXISTS medical_orders_all ON medical_orders;
DROP POLICY IF EXISTS medical_orders_clinic ON medical_orders;
DROP POLICY IF EXISTS medical_orders_patient ON medical_orders;
DROP POLICY IF EXISTS medical_orders_select ON medical_orders;
DROP POLICY IF EXISTS medical_orders_insert ON medical_orders;
DROP POLICY IF EXISTS medical_orders_update ON medical_orders;

CREATE POLICY medical_orders_select ON medical_orders FOR SELECT
  USING (is_superadmin() OR can_view_clinical(clinic_id));

CREATE POLICY medical_orders_insert ON medical_orders FOR INSERT
  WITH CHECK (is_superadmin() OR can_write_clinical(clinic_id));

CREATE POLICY medical_orders_update ON medical_orders FOR UPDATE
  USING (is_superadmin() OR can_write_clinical(clinic_id));

CREATE POLICY medical_orders_delete ON medical_orders FOR DELETE
  USING (is_superadmin() OR can_write_clinical(clinic_id));

-- Re-assert: secretary excluded from clinical reads (034 definition)
CREATE OR REPLACE FUNCTION can_view_clinical(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_superadmin() OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'doctor');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON TABLE patient_clinical_profiles IS
  'PHI clínico del paciente — solo personal clínico (can_view_clinical). Demografía en patients.';
