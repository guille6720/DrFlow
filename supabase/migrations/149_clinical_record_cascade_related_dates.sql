-- When consultation date (clinical_records.created_at) changes, keep related
-- diagnoses, treatments, and prescriptions aligned to the same timestamp.

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS record_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE clinical_record_audit
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

CREATE OR REPLACE FUNCTION public.sync_clinical_record_related_dates(
  p_clinic_id UUID,
  p_record_id UUID,
  p_consultation_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_consultation_at IS NULL THEN
    RETURN;
  END IF;

  UPDATE clinical_record_diagnoses
  SET
    created_at = p_consultation_at,
    updated_at = now()
  WHERE clinical_record_id = p_record_id
    AND clinic_id = p_clinic_id;

  UPDATE clinical_record_treatments
  SET
    created_at = p_consultation_at,
    updated_at = now()
  WHERE clinical_record_id = p_record_id
    AND clinic_id = p_clinic_id;

  UPDATE prescription_drafts
  SET
    created_at = p_consultation_at,
    issued_at = CASE
      WHEN issued_at IS NOT NULL THEN p_consultation_at
      ELSE issued_at
    END,
    updated_at = now()
  WHERE clinical_record_id = p_record_id
    AND clinic_id = p_clinic_id;

  UPDATE medical_orders
  SET
    created_at = p_consultation_at,
    issued_at = p_consultation_at,
    updated_at = now()
  WHERE clinical_record_id = p_record_id
    AND clinic_id = p_clinic_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_clinical_record_related_dates(UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_clinical_record_related_dates(UUID, UUID, TIMESTAMPTZ)
  TO service_role;

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

  -- Child sync inserts with DEFAULT now(); realign diagnoses/treatments/Rx/orders
  -- to the consultation date (also covers explicit date changes).
  PERFORM public.sync_clinical_record_related_dates(
    p_clinic_id,
    p_record_id,
    v_new.created_at
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

-- Lean date-only update (avoids wiping children via empty JSON sync).
CREATE OR REPLACE FUNCTION public.update_clinical_record_consultation_at(
  p_clinic_id UUID,
  p_record_id UUID,
  p_consultation_at TIMESTAMPTZ,
  p_updated_by UUID,
  p_audit_ip TEXT DEFAULT NULL,
  p_audit_user_agent TEXT DEFAULT NULL
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
  IF p_consultation_at IS NULL THEN
    RAISE EXCEPTION 'INVALID_CONSULTATION_AT';
  END IF;

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
    created_at = p_consultation_at,
    updated_by = p_updated_by,
    updated_at = now(),
    record_version = COALESCE(v_old.record_version, 1) + 1
  WHERE id = p_record_id AND clinic_id = p_clinic_id
  RETURNING * INTO v_new;

  PERFORM public.sync_clinical_record_related_dates(
    p_clinic_id,
    p_record_id,
    p_consultation_at
  );

  INSERT INTO clinical_record_audit (
    clinical_record_id, clinic_id, patient_id, module, what, action,
    changed_by, old_values, new_values, ip_address, user_agent, change_reason
  )
  VALUES (
    p_record_id,
    p_clinic_id,
    v_new.patient_id,
    'clinical',
    'Modificó fecha de consulta clínica',
    'update'::audit_action,
    p_updated_by,
    to_jsonb(v_old),
    to_jsonb(v_new),
    NULLIF(trim(p_audit_ip), '')::inet,
    NULLIF(trim(p_audit_user_agent), ''),
    NULL
  );

  RETURN jsonb_build_object('old', to_jsonb(v_old), 'data', to_jsonb(v_new));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_clinical_record_consultation_at(
  UUID, UUID, TIMESTAMPTZ, UUID, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_clinical_record_consultation_at(
  UUID, UUID, TIMESTAMPTZ, UUID, TEXT, TEXT
) TO authenticated, service_role;
