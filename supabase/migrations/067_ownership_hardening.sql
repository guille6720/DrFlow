-- Ownership hardening (067): reject cross-clinic FK tampering at DB layer.
-- Complements app-layer checks in src/core/security/ownership-guard.ts

-- ---------------------------------------------------------------------------
-- 1. Reject clinic_id drift (was silently rewritten in 060)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_patient_clinic_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_patient_clinic UUID;
BEGIN
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT clinic_id INTO v_patient_clinic
  FROM patients
  WHERE id = NEW.patient_id;

  IF v_patient_clinic IS NULL THEN
    RAISE EXCEPTION 'patient_id % does not exist', NEW.patient_id;
  END IF;

  IF NEW.clinic_id IS DISTINCT FROM v_patient_clinic THEN
    RAISE EXCEPTION 'patient_id % does not belong to clinic_id %', NEW.patient_id, NEW.clinic_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Shared FK-in-clinic assertion for SECURITY DEFINER RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assert_fk_in_clinic(
  p_clinic_id UUID,
  p_table regclass,
  p_id UUID,
  p_label TEXT DEFAULT 'resource'
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_found BOOLEAN;
BEGIN
  IF p_id IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM %s WHERE id = $1 AND clinic_id = $2)',
    p_table
  )
  INTO v_found
  USING p_id, p_clinic_id;

  IF NOT v_found THEN
    RAISE EXCEPTION '% does not belong to clinic_id %', p_label, p_clinic_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION assert_appointment_patient_match(
  p_clinic_id UUID,
  p_appointment_id UUID,
  p_patient_id UUID
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_appt_patient UUID;
BEGIN
  IF p_appointment_id IS NULL THEN
    RETURN;
  END IF;

  SELECT patient_id INTO v_appt_patient
  FROM appointments
  WHERE id = p_appointment_id AND clinic_id = p_clinic_id;

  IF v_appt_patient IS NULL THEN
    RAISE EXCEPTION 'appointment_id does not belong to clinic_id %', p_clinic_id;
  END IF;

  IF v_appt_patient IS DISTINCT FROM p_patient_id THEN
    RAISE EXCEPTION 'appointment_id does not match patient_id';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Clinical record RPCs — validate FK ownership before write
-- ---------------------------------------------------------------------------
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
  p_audit_what TEXT DEFAULT 'Creó consulta clínica (SOAP)',
  p_audit_ip TEXT DEFAULT NULL,
  p_audit_user_agent TEXT DEFAULT NULL
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

  PERFORM assert_fk_in_clinic(p_clinic_id, 'patients'::regclass, p_patient_id, 'patient_id');
  PERFORM assert_fk_in_clinic(p_clinic_id, 'professionals'::regclass, p_professional_id, 'professional_id');
  PERFORM assert_fk_in_clinic(p_clinic_id, 'appointments'::regclass, p_appointment_id, 'appointment_id');
  PERFORM assert_appointment_patient_match(p_clinic_id, p_appointment_id, p_patient_id);

  INSERT INTO clinical_records (
    clinic_id, patient_id, professional_id, appointment_id,
    chief_complaint, diagnosis, evolution, indications, created_by
  )
  VALUES (
    p_clinic_id, p_patient_id, p_professional_id, p_appointment_id,
    p_chief_complaint, p_diagnosis, p_evolution, p_indications, p_created_by
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
  p_audit_what TEXT DEFAULT 'Modificó consulta clínica (SOAP)',
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
  IF NOT can_write_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_updated_by IS DISTINCT FROM auth.uid() AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM assert_fk_in_clinic(p_clinic_id, 'patients'::regclass, p_patient_id, 'patient_id');
  PERFORM assert_fk_in_clinic(p_clinic_id, 'professionals'::regclass, p_professional_id, 'professional_id');
  PERFORM assert_fk_in_clinic(p_clinic_id, 'appointments'::regclass, p_appointment_id, 'appointment_id');
  PERFORM assert_appointment_patient_match(p_clinic_id, p_appointment_id, p_patient_id);

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

-- ---------------------------------------------------------------------------
-- 4. Cash RPCs — validate FK ownership before write
-- ---------------------------------------------------------------------------
DO $migration$
BEGIN
  IF to_regclass('public.cash_charges') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $sql$
CREATE OR REPLACE FUNCTION public.create_cash_charge_atomic(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_appointment_id UUID,
  p_charge_kind cash_charge_kind,
  p_attention_type cash_attention_type,
  p_payment_method cash_payment_method,
  p_motive TEXT,
  p_amount DECIMAL,
  p_status cash_charge_status,
  p_notes TEXT,
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_charge cash_charges%ROWTYPE;
  v_prev DECIMAL := 0;
BEGIN
  IF NOT can_manage_cash(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM assert_fk_in_clinic(p_clinic_id, 'patients'::regclass, p_patient_id, 'patient_id');
  PERFORM assert_fk_in_clinic(p_clinic_id, 'professionals'::regclass, p_professional_id, 'professional_id');
  PERFORM assert_fk_in_clinic(p_clinic_id, 'appointments'::regclass, p_appointment_id, 'appointment_id');
  PERFORM assert_appointment_patient_match(p_clinic_id, p_appointment_id, p_patient_id);

  INSERT INTO cash_charges (
    clinic_id, patient_id, professional_id, appointment_id,
    charge_kind, attention_type, payment_method, motive, amount, status,
    notes, created_by, updated_by
  )
  VALUES (
    p_clinic_id, p_patient_id, p_professional_id, p_appointment_id,
    p_charge_kind, p_attention_type, p_payment_method, p_motive, p_amount, p_status,
    p_notes, p_created_by, p_created_by
  )
  RETURNING * INTO v_charge;

  IF p_payment_method = 'account' AND p_status = 'collected' THEN
    SELECT balance_after INTO v_prev
    FROM patient_ledger_entries
    WHERE clinic_id = p_clinic_id AND patient_id = p_patient_id
    ORDER BY entry_at DESC
    LIMIT 1
    FOR UPDATE;

    v_prev := COALESCE(v_prev, 0);

    INSERT INTO patient_ledger_entries (
      clinic_id, patient_id, professional_id, cash_charge_id,
      concept, debit, credit, balance_after, notes, created_by
    )
    VALUES (
      p_clinic_id, p_patient_id, p_professional_id, v_charge.id,
      p_motive, p_amount, 0, v_prev + p_amount, p_notes, p_created_by
    );
  END IF;

  RETURN to_jsonb(v_charge);
END;
$body$;
$sql$;

  EXECUTE $sql$
CREATE OR REPLACE FUNCTION public.add_patient_ledger_entry_atomic(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_concept TEXT,
  p_debit DECIMAL,
  p_credit DECIMAL,
  p_notes TEXT,
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_prev DECIMAL := 0;
  v_entry patient_ledger_entries%ROWTYPE;
BEGIN
  IF NOT can_manage_cash(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM assert_fk_in_clinic(p_clinic_id, 'patients'::regclass, p_patient_id, 'patient_id');
  PERFORM assert_fk_in_clinic(p_clinic_id, 'professionals'::regclass, p_professional_id, 'professional_id');

  SELECT balance_after INTO v_prev
  FROM patient_ledger_entries
  WHERE clinic_id = p_clinic_id AND patient_id = p_patient_id
  ORDER BY entry_at DESC
  LIMIT 1
  FOR UPDATE;

  v_prev := COALESCE(v_prev, 0);

  INSERT INTO patient_ledger_entries (
    clinic_id, patient_id, professional_id, concept,
    debit, credit, balance_after, notes, created_by
  )
  VALUES (
    p_clinic_id, p_patient_id, p_professional_id, p_concept,
    p_debit, p_credit, v_prev + p_debit - p_credit, p_notes, p_created_by
  )
  RETURNING * INTO v_entry;

  RETURN to_jsonb(v_entry);
END;
$body$;
$sql$;
END
$migration$;
