-- Fix ambiguous update_clinical_record_atomic overloads on production.
-- Migration 130 added p_change_reason via CREATE OR REPLACE (new signature) without
-- dropping the 111/063 variants, so PostgREST cannot resolve RPC calls.

DROP FUNCTION IF EXISTS public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB
);
DROP FUNCTION IF EXISTS public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT
);

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
  p_treatments_json JSONB DEFAULT '[]'::jsonb,
  p_change_reason TEXT DEFAULT NULL
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
    updated_at = now(),
    record_version = COALESCE(v_old.record_version, 1) + 1
  WHERE id = p_record_id AND clinic_id = p_clinic_id
  RETURNING * INTO v_new;

  PERFORM public.sync_clinical_record_children(
    p_record_id,
    p_clinic_id,
    p_patient_id,
    COALESCE(p_diagnoses_json, '[]'::jsonb),
    COALESCE(p_treatments_json, '[]'::jsonb),
    p_updated_by
  );

  INSERT INTO clinical_record_audit (
    clinical_record_id, clinic_id, patient_id, module, what, action,
    changed_by, old_values, new_values, ip_address, user_agent, change_reason
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
    NULLIF(trim(p_audit_user_agent), ''),
    NULLIF(trim(COALESCE(p_change_reason, '')), '')
  );

  RETURN jsonb_build_object('old', to_jsonb(v_old), 'data', to_jsonb(v_new));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT
) TO authenticated, service_role;
