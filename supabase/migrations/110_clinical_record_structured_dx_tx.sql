-- Structured diagnoses/treatments on clinical_records (additive, dual-write with TEXT legacy).
-- Staging only. Does not delete or rewrite existing clinical text fields.

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS diagnosis_cie10 TEXT,
  ADD COLUMN IF NOT EXISTS diagnoses_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS treatments_json JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN clinical_records.diagnosis_cie10 IS
  'Primary CIE-10 code for the consultation (optional; diagnosis TEXT remains canonical for display).';
COMMENT ON COLUMN clinical_records.diagnoses_json IS
  'Structured diagnoses array [{name, cie10_code, pathology_id, is_chronic}]. Dual-write with diagnosis TEXT.';
COMMENT ON COLUMN clinical_records.treatments_json IS
  'Structured treatments array [{product, dose, frequency, notes, status, vademecum_code}]. Dual-write with indications TEXT.';

CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_cie10
  ON clinical_records (clinic_id, diagnosis_cie10)
  WHERE diagnosis_cie10 IS NOT NULL AND trim(diagnosis_cie10) <> '';

-- Recreate RPCs with optional structured payloads (defaults keep old callers working via named args).
DROP FUNCTION IF EXISTS public.create_clinical_record_atomic(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.create_clinical_record_atomic(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_appointment_id UUID,
  p_chief_complaint TEXT,
  p_diagnosis TEXT,
  p_evolution TEXT,
  p_indications TEXT,
  p_created_by UUID,
  p_consultation_modality TEXT DEFAULT NULL,
  p_consultation_at TIMESTAMPTZ DEFAULT NULL,
  p_audit_what TEXT DEFAULT 'Creó consulta clínica (SOAP)',
  p_audit_ip TEXT DEFAULT NULL,
  p_audit_user_agent TEXT DEFAULT NULL,
  p_diagnosis_cie10 TEXT DEFAULT NULL,
  p_diagnoses_json JSONB DEFAULT '[]'::jsonb,
  p_treatments_json JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record clinical_records%ROWTYPE;
BEGIN
  IF NOT can_write_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_created_by IS DISTINCT FROM auth.uid() AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO clinical_records (
    clinic_id, patient_id, professional_id, appointment_id,
    chief_complaint, diagnosis, evolution, indications,
    diagnosis_cie10, diagnoses_json, treatments_json,
    created_by, created_at
  )
  VALUES (
    p_clinic_id, p_patient_id, p_professional_id, p_appointment_id,
    p_chief_complaint, p_diagnosis, p_evolution, p_indications,
    NULLIF(trim(COALESCE(p_diagnosis_cie10, '')), ''),
    COALESCE(p_diagnoses_json, '[]'::jsonb),
    COALESCE(p_treatments_json, '[]'::jsonb),
    p_created_by,
    COALESCE(p_consultation_at, now())
  )
  RETURNING * INTO v_record;

  IF p_appointment_id IS NOT NULL THEN
    UPDATE appointments
    SET
      status = 'attended'::appointment_status,
      consultation_modality = COALESCE(
        NULLIF(trim(p_consultation_modality), ''),
        consultation_modality
      ),
      updated_at = now()
    WHERE id = p_appointment_id
      AND clinic_id = p_clinic_id;
  END IF;

  INSERT INTO clinical_record_audit (
    clinical_record_id, clinic_id, patient_id, module, what, action,
    changed_by, new_values, ip_address, user_agent
  )
  VALUES (
    v_record.id,
    p_clinic_id,
    p_patient_id,
    'clinical',
    p_audit_what,
    'create'::audit_action,
    p_created_by,
    to_jsonb(v_record),
    NULLIF(trim(p_audit_ip), '')::inet,
    NULLIF(trim(p_audit_user_agent), '')
  );

  RETURN to_jsonb(v_record);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_clinical_record_atomic(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_clinical_record_atomic(
  p_clinic_id UUID,
  p_record_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_appointment_id UUID,
  p_chief_complaint TEXT,
  p_diagnosis TEXT,
  p_evolution TEXT,
  p_indications TEXT,
  p_updated_by UUID,
  p_consultation_at TIMESTAMPTZ DEFAULT NULL,
  p_audit_what TEXT DEFAULT 'Modificó consulta clínica (SOAP)',
  p_audit_ip TEXT DEFAULT NULL,
  p_audit_user_agent TEXT DEFAULT NULL,
  p_diagnosis_cie10 TEXT DEFAULT NULL,
  p_diagnoses_json JSONB DEFAULT '[]'::jsonb,
  p_treatments_json JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old clinical_records%ROWTYPE;
  v_new clinical_records%ROWTYPE;
BEGIN
  IF NOT can_write_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_updated_by IS DISTINCT FROM auth.uid() AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_old
  FROM clinical_records
  WHERE id = p_record_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECORD_NOT_FOUND';
  END IF;

  UPDATE clinical_records
  SET
    patient_id = p_patient_id,
    professional_id = p_professional_id,
    appointment_id = p_appointment_id,
    chief_complaint = p_chief_complaint,
    diagnosis = p_diagnosis,
    evolution = p_evolution,
    indications = p_indications,
    diagnosis_cie10 = NULLIF(trim(COALESCE(p_diagnosis_cie10, '')), ''),
    diagnoses_json = COALESCE(p_diagnoses_json, '[]'::jsonb),
    treatments_json = COALESCE(p_treatments_json, '[]'::jsonb),
    created_at = COALESCE(p_consultation_at, created_at),
    updated_by = p_updated_by,
    updated_at = now()
  WHERE id = p_record_id AND clinic_id = p_clinic_id
  RETURNING * INTO v_new;

  INSERT INTO clinical_record_audit (
    clinical_record_id, clinic_id, patient_id, module, what, action,
    changed_by, old_values, new_values, ip_address, user_agent
  )
  VALUES (
    p_record_id,
    p_clinic_id,
    p_patient_id,
    'clinical',
    p_audit_what,
    'update'::audit_action,
    p_updated_by,
    to_jsonb(v_old),
    to_jsonb(v_new),
    NULLIF(trim(p_audit_ip), '')::inet,
    NULLIF(trim(p_audit_user_agent), '')
  );

  RETURN jsonb_build_object('old', to_jsonb(v_old), 'data', to_jsonb(v_new));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB
) TO authenticated;
