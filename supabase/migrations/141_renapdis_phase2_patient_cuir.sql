-- ReNaPDiS Phase 2 readiness: patient identity + prescription CUIR / national readiness.
-- Additive only. Does NOT invent Ministry APIs or official DNSISA identifiers.
-- Staging-oriented. Do not apply to production as part of this Phase 2 task.

-- ---------------------------------------------------------------------------
-- Patients: electronic prescription identity fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cuil text,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'dni',
  ADD COLUMN IF NOT EXISTS alt_identifier_type text,
  ADD COLUMN IF NOT EXISTS alt_identifier_value text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_sex_check' AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_sex_check
      CHECK (sex IS NULL OR sex IN ('F', 'M', 'X'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_document_type_check' AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_document_type_check
      CHECK (document_type IN ('dni', 'passport', 'cuit', 'cdi', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_alt_identifier_type_check' AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_alt_identifier_type_check
      CHECK (
        alt_identifier_type IS NULL
        OR alt_identifier_type IN ('cuit', 'cdi', 'passport', 'other')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.patients.cuil IS
  'CUIL del paciente para receta electrónica nacional (Phase 2). Local CRUD no lo exige.';
COMMENT ON COLUMN public.patients.sex IS
  'Sexo registral F|M|X para bloques de receta nacional.';
COMMENT ON COLUMN public.patients.document_type IS
  'Tipo de documento primario (dni por defecto).';
COMMENT ON COLUMN public.patients.alt_identifier_type IS
  'Identificador alternativo permitido cuando no hay CUIL (cuit|cdi|passport|other).';
COMMENT ON COLUMN public.patients.alt_identifier_value IS
  'Valor del identificador alternativo.';

CREATE INDEX IF NOT EXISTS idx_patients_clinic_cuil
  ON public.patients (clinic_id, cuil)
  WHERE cuil IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Prescription drafts: CUIR components + national readiness (additive)
-- ---------------------------------------------------------------------------
ALTER TABLE public.prescription_drafts
  ADD COLUMN IF NOT EXISTS validity_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS prescription_category text NOT NULL DEFAULT 'medication',
  ADD COLUMN IF NOT EXISTS prescription_subtype text,
  ADD COLUMN IF NOT EXISTS national_rx_status text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS cuir_status text NOT NULL DEFAULT 'pending_official_ids',
  ADD COLUMN IF NOT EXISTS cuir_platform_id text,
  ADD COLUMN IF NOT EXISTS cuir_repository_id text,
  ADD COLUMN IF NOT EXISTS cuir_jurisdiction text,
  ADD COLUMN IF NOT EXISTS cuir_type_subtype text,
  ADD COLUMN IF NOT EXISTS cuir_group_id text,
  ADD COLUMN IF NOT EXISTS cuir_item_number text,
  ADD COLUMN IF NOT EXISTS cuir_formatted text,
  ADD COLUMN IF NOT EXISTS diagnosis_coding jsonb,
  ADD COLUMN IF NOT EXISTS fhir_bundle_meta jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prescription_drafts_category_check'
      AND conrelid = 'public.prescription_drafts'::regclass
  ) THEN
    ALTER TABLE public.prescription_drafts
      ADD CONSTRAINT prescription_drafts_category_check
      CHECK (
        prescription_category IN (
          'medication',
          'device',
          'complementary_study',
          'practice',
          'procedure'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prescription_drafts_national_rx_status_check'
      AND conrelid = 'public.prescription_drafts'::regclass
  ) THEN
    ALTER TABLE public.prescription_drafts
      ADD CONSTRAINT prescription_drafts_national_rx_status_check
      CHECK (
        national_rx_status IN (
          'local',
          'sandbox',
          'national_ready',
          'submitted',
          'failed'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prescription_drafts_cuir_status_check'
      AND conrelid = 'public.prescription_drafts'::regclass
  ) THEN
    ALTER TABLE public.prescription_drafts
      ADD CONSTRAINT prescription_drafts_cuir_status_check
      CHECK (cuir_status IN ('sandbox', 'pending_official_ids', 'official'));
  END IF;
END $$;

COMMENT ON COLUMN public.prescription_drafts.national_rx_status IS
  'Phase 2 national e-Rx readiness: local|sandbox|national_ready|submitted|failed.';
COMMENT ON COLUMN public.prescription_drafts.cuir_status IS
  'CUIR environment: sandbox|pending_official_ids|official. Sandbox is never legally valid.';
COMMENT ON COLUMN public.prescription_drafts.cuir_platform_id IS
  'CUIR component 1 — platform id assigned by DNSISA (placeholder until assigned).';
COMMENT ON COLUMN public.prescription_drafts.cuir_repository_id IS
  'CUIR component 2 — repository id assigned by DNSISA (placeholder until assigned).';
COMMENT ON COLUMN public.prescription_drafts.diagnosis_coding IS
  'Terminology coding snapshot (SNOMED/system/display/version) without inventing codes.';

CREATE INDEX IF NOT EXISTS idx_prescription_drafts_clinic_national_rx
  ON public.prescription_drafts (clinic_id, national_rx_status);

-- ---------------------------------------------------------------------------
-- Extend patient create/update RPCs for Phase 2 identity fields (additive)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_patient_with_clinical_profile(
  p_clinic_id UUID,
  p_patient JSONB,
  p_profile JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient patients%ROWTYPE;
BEGIN
  IF NOT (
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'doctor', 'secretary')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO patients (
    clinic_id, first_name, last_name, document_number, document_type, cuil,
    alt_identifier_type, alt_identifier_value, birth_date, sex, phone, email,
    address, insurance_provider, insurance_plan, insurance_number,
    emergency_contact_name, emergency_contact_phone
  )
  VALUES (
    p_clinic_id,
    p_patient->>'first_name',
    p_patient->>'last_name',
    p_patient->>'document_number',
    COALESCE(NULLIF(p_patient->>'document_type', ''), 'dni'),
    NULLIF(p_patient->>'cuil', ''),
    NULLIF(p_patient->>'alt_identifier_type', ''),
    NULLIF(p_patient->>'alt_identifier_value', ''),
    NULLIF(p_patient->>'birth_date', '')::date,
    NULLIF(p_patient->>'sex', ''),
    NULLIF(p_patient->>'phone', ''),
    NULLIF(p_patient->>'email', ''),
    NULLIF(p_patient->>'address', ''),
    NULLIF(p_patient->>'insurance_provider', ''),
    NULLIF(p_patient->>'insurance_plan', ''),
    NULLIF(p_patient->>'insurance_number', ''),
    NULLIF(p_patient->>'emergency_contact_name', ''),
    NULLIF(p_patient->>'emergency_contact_phone', '')
  )
  RETURNING * INTO v_patient;

  IF p_profile IS NOT NULL THEN
    INSERT INTO patient_clinical_profiles (
      patient_id, clinic_id, medical_history, allergies, regular_medication, notes
    )
    VALUES (
      v_patient.id,
      p_clinic_id,
      NULLIF(p_profile->>'medical_history', ''),
      NULLIF(p_profile->>'allergies', ''),
      NULLIF(p_profile->>'regular_medication', ''),
      NULLIF(p_profile->>'notes', '')
    );
  END IF;

  RETURN to_jsonb(v_patient);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_patient_with_clinical_profile(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_patient JSONB,
  p_profile JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old patients%ROWTYPE;
  v_new patients%ROWTYPE;
BEGIN
  IF NOT (
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'doctor', 'secretary')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_old
  FROM patients
  WHERE id = p_patient_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;

  UPDATE patients
  SET
    first_name = COALESCE(p_patient->>'first_name', first_name),
    last_name = COALESCE(p_patient->>'last_name', last_name),
    document_number = COALESCE(p_patient->>'document_number', document_number),
    document_type = COALESCE(NULLIF(p_patient->>'document_type', ''), document_type),
    cuil = COALESCE(NULLIF(p_patient->>'cuil', ''), cuil),
    alt_identifier_type = COALESCE(NULLIF(p_patient->>'alt_identifier_type', ''), alt_identifier_type),
    alt_identifier_value = COALESCE(NULLIF(p_patient->>'alt_identifier_value', ''), alt_identifier_value),
    birth_date = COALESCE(NULLIF(p_patient->>'birth_date', '')::date, birth_date),
    sex = COALESCE(NULLIF(p_patient->>'sex', ''), sex),
    phone = COALESCE(NULLIF(p_patient->>'phone', ''), phone),
    email = COALESCE(NULLIF(p_patient->>'email', ''), email),
    address = COALESCE(NULLIF(p_patient->>'address', ''), address),
    insurance_provider = COALESCE(NULLIF(p_patient->>'insurance_provider', ''), insurance_provider),
    insurance_plan = COALESCE(NULLIF(p_patient->>'insurance_plan', ''), insurance_plan),
    insurance_number = COALESCE(NULLIF(p_patient->>'insurance_number', ''), insurance_number),
    emergency_contact_name = COALESCE(NULLIF(p_patient->>'emergency_contact_name', ''), emergency_contact_name),
    emergency_contact_phone = COALESCE(NULLIF(p_patient->>'emergency_contact_phone', ''), emergency_contact_phone),
    updated_at = now()
  WHERE id = p_patient_id AND clinic_id = p_clinic_id
  RETURNING * INTO v_new;

  IF p_profile IS NOT NULL THEN
    INSERT INTO patient_clinical_profiles (
      patient_id, clinic_id, medical_history, allergies, regular_medication, notes, updated_at
    )
    VALUES (
      p_patient_id,
      p_clinic_id,
      NULLIF(p_profile->>'medical_history', ''),
      NULLIF(p_profile->>'allergies', ''),
      NULLIF(p_profile->>'regular_medication', ''),
      NULLIF(p_profile->>'notes', ''),
      now()
    )
    ON CONFLICT (patient_id) DO UPDATE SET
      medical_history = EXCLUDED.medical_history,
      allergies = EXCLUDED.allergies,
      regular_medication = EXCLUDED.regular_medication,
      notes = EXCLUDED.notes,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object('old', to_jsonb(v_old), 'data', to_jsonb(v_new));
END;
$$;
