-- Phase 20: atomic multi-table operations via SECURITY DEFINER RPCs.
-- Each function runs in a single PostgreSQL transaction (implicit); any error rolls back all writes.
-- See ATOMIC_OPERATIONS_AUDIT_REPORT.md

-- ---------------------------------------------------------------------------
-- 1. Public booking + consent (single transaction)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.submit_public_booking(
  TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_slug TEXT,
  p_professional_id UUID,
  p_start_at TIMESTAMPTZ,
  p_first_name TEXT,
  p_last_name TEXT,
  p_document_number TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_consent_type TEXT DEFAULT NULL,
  p_consent_document_version TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
  v_link_id UUID;
  v_patient_id UUID;
  v_appointment_id UUID;
  v_duration INTEGER;
  v_end_at TIMESTAMPTZ;
  v_prof_clinic UUID;
BEGIN
  SELECT bl.clinic_id, bl.id INTO v_clinic_id, v_link_id
  FROM public_booking_links bl
  WHERE bl.slug = p_slug AND bl.is_active = true;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Link de reserva inválido o inactivo';
  END IF;

  SELECT clinic_id INTO v_prof_clinic
  FROM professionals
  WHERE id = p_professional_id AND is_active = true;

  IF v_prof_clinic IS NULL OR v_prof_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'Profesional no válido para esta clínica';
  END IF;

  IF p_start_at < now() THEN
    RAISE EXCEPTION 'El horario seleccionado ya pasó';
  END IF;

  SELECT default_appointment_duration INTO v_duration FROM clinics WHERE id = v_clinic_id;
  v_end_at := p_start_at + (COALESCE(v_duration, 30) || ' minutes')::interval;

  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.professional_id = p_professional_id
      AND a.status NOT IN ('cancelled'::appointment_status)
      AND a.start_at < v_end_at
      AND a.end_at > p_start_at
  ) THEN
    RAISE EXCEPTION 'El horario ya no está disponible';
  END IF;

  SELECT id INTO v_patient_id
  FROM patients
  WHERE clinic_id = v_clinic_id AND document_number = trim(p_document_number);

  IF v_patient_id IS NULL THEN
    INSERT INTO patients (clinic_id, first_name, last_name, document_number, phone, email)
    VALUES (
      v_clinic_id,
      trim(p_first_name),
      trim(p_last_name),
      trim(p_document_number),
      trim(p_phone),
      NULLIF(trim(p_email), '')
    )
    RETURNING id INTO v_patient_id;
  ELSE
    UPDATE patients SET
      first_name = trim(p_first_name),
      last_name = trim(p_last_name),
      phone = trim(p_phone),
      email = COALESCE(NULLIF(trim(p_email), ''), email),
      updated_at = now()
    WHERE id = v_patient_id;
  END IF;

  INSERT INTO appointments (
    clinic_id, patient_id, professional_id, location_id, specialty_id,
    start_at, end_at, status, notes, booking_source
  )
  SELECT
    v_clinic_id,
    v_patient_id,
    p_professional_id,
    pro.location_id,
    pro.specialty_id,
    p_start_at,
    v_end_at,
    'pending'::appointment_status,
    COALESCE(p_reason, 'Solicitud online'),
    'online'
  FROM professionals pro
  WHERE pro.id = p_professional_id
  RETURNING id INTO v_appointment_id;

  IF p_consent_type IS NOT NULL AND trim(p_consent_type) <> '' THEN
    INSERT INTO consent_records (
      clinic_id, patient_id, consent_type, granted, granted_at, document_version
    )
    VALUES (
      v_clinic_id,
      v_patient_id,
      trim(p_consent_type),
      true,
      now(),
      p_consent_document_version
    );
  END IF;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'patient_id', v_patient_id,
    'clinic_id', v_clinic_id,
    'status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_booking(
  TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Waiting room — single appointments UPDATE (requires 034 enum/column)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE waiting_room_status AS ENUM (
    'waiting', 'confirmed', 'in_consultation', 'finished', 'cancelled', 'absent'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS waiting_room_status waiting_room_status NOT NULL DEFAULT 'waiting';

CREATE OR REPLACE FUNCTION public.update_waiting_room_status_atomic(
  p_clinic_id UUID,
  p_appointment_id UUID,
  p_waiting_room_status waiting_room_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row appointments%ROWTYPE;
  v_appt_status appointment_status;
BEGIN
  IF NOT (
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'secretary')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_appt_status := CASE p_waiting_room_status
    WHEN 'absent' THEN 'no_show'::appointment_status
    WHEN 'cancelled' THEN 'cancelled'::appointment_status
    WHEN 'finished' THEN 'attended'::appointment_status
    ELSE NULL
  END;

  UPDATE appointments
  SET
    waiting_room_status = p_waiting_room_status,
    status = COALESCE(v_appt_status, status),
    cancelled_at = CASE
      WHEN p_waiting_room_status = 'cancelled' AND cancelled_at IS NULL THEN now()
      ELSE cancelled_at
    END,
    updated_at = now()
  WHERE id = p_appointment_id
    AND clinic_id = p_clinic_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'waiting_room_status', v_row.waiting_room_status,
    'status', v_row.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_waiting_room_status_atomic(UUID, UUID, waiting_room_status)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Telemedicine session + appointment modality
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_telemedicine_session_atomic(
  p_clinic_id UUID,
  p_appointment_id UUID,
  p_room_url TEXT,
  p_status telemedicine_status,
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session telemedicine_sessions%ROWTYPE;
BEGIN
  IF NOT can_view_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM appointments
    WHERE id = p_appointment_id AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  INSERT INTO telemedicine_sessions (
    clinic_id, appointment_id, room_url, status, created_by
  )
  VALUES (
    p_clinic_id, p_appointment_id, p_room_url, p_status, p_created_by
  )
  RETURNING * INTO v_session;

  UPDATE appointments
  SET consultation_modality = 'virtual', updated_at = now()
  WHERE id = p_appointment_id AND clinic_id = p_clinic_id;

  RETURN to_jsonb(v_session);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_telemedicine_session_atomic(UUID, UUID, TEXT, telemedicine_status, UUID)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Clinical record + optional appointment + audit row
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

GRANT EXECUTE ON FUNCTION public.create_clinical_record_atomic(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT
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

GRANT EXECUTE ON FUNCTION public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Patient + clinical profile
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
    clinic_id, first_name, last_name, document_number, birth_date, phone, email,
    address, insurance_provider, insurance_plan, insurance_number,
    emergency_contact_name, emergency_contact_phone
  )
  VALUES (
    p_clinic_id,
    p_patient->>'first_name',
    p_patient->>'last_name',
    p_patient->>'document_number',
    NULLIF(p_patient->>'birth_date', '')::date,
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

GRANT EXECUTE ON FUNCTION public.create_patient_with_clinical_profile(UUID, JSONB, JSONB)
  TO authenticated;

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
    birth_date = COALESCE(NULLIF(p_patient->>'birth_date', '')::date, birth_date),
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

GRANT EXECUTE ON FUNCTION public.update_patient_with_clinical_profile(UUID, UUID, JSONB, JSONB)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Clinic member invitation (existing user)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_clinic_invitation_for_existing_user(
  p_clinic_id UUID,
  p_user_id UUID,
  p_email TEXT,
  p_role user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_manage_clinic(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO clinic_members (clinic_id, user_id, role, is_active)
  VALUES (p_clinic_id, p_user_id, p_role, true)
  ON CONFLICT (clinic_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = true,
    updated_at = now();

  UPDATE clinic_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE clinic_id = p_clinic_id
    AND lower(email) = lower(trim(p_email));
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_clinic_invitation_for_existing_user(UUID, UUID, TEXT, user_role)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Caja — charge/void + ledger (requires migration 034)
-- ---------------------------------------------------------------------------
DO $$
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
CREATE OR REPLACE FUNCTION public.void_cash_charge_atomic(
  p_clinic_id UUID,
  p_charge_id UUID,
  p_reason TEXT,
  p_updated_by UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_charge cash_charges%ROWTYPE;
  v_prev DECIMAL := 0;
  v_credit DECIMAL;
BEGIN
  IF NOT can_manage_cash(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_charge
  FROM cash_charges
  WHERE id = p_charge_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHARGE_NOT_FOUND';
  END IF;

  IF v_charge.status = 'voided' THEN
    RAISE EXCEPTION 'ALREADY_VOIDED';
  END IF;

  UPDATE cash_charges
  SET
    status = 'voided',
    voided_at = now(),
    void_reason = p_reason,
    updated_by = p_updated_by
  WHERE id = p_charge_id AND clinic_id = p_clinic_id;

  IF v_charge.payment_method = 'account' THEN
    v_credit := v_charge.amount;

    SELECT balance_after INTO v_prev
    FROM patient_ledger_entries
    WHERE clinic_id = p_clinic_id AND patient_id = v_charge.patient_id
    ORDER BY entry_at DESC
    LIMIT 1
    FOR UPDATE;

    v_prev := COALESCE(v_prev, 0);

    INSERT INTO patient_ledger_entries (
      clinic_id, patient_id, professional_id, cash_charge_id,
      concept, debit, credit, balance_after, created_by
    )
    VALUES (
      p_clinic_id, v_charge.patient_id, v_charge.professional_id, v_charge.id,
      'Anulación: ' || p_reason, 0, v_credit, GREATEST(0, v_prev - v_credit), p_updated_by
    );
  END IF;
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

  EXECUTE $sql$
    GRANT EXECUTE ON FUNCTION public.create_cash_charge_atomic(
      UUID, UUID, UUID, UUID, cash_charge_kind, cash_attention_type, cash_payment_method,
      TEXT, DECIMAL, cash_charge_status, TEXT, UUID
    ) TO authenticated
  $sql$;

  EXECUTE $sql$
    GRANT EXECUTE ON FUNCTION public.void_cash_charge_atomic(UUID, UUID, TEXT, UUID)
    TO authenticated
  $sql$;

  EXECUTE $sql$
    GRANT EXECUTE ON FUNCTION public.add_patient_ledger_entry_atomic(
      UUID, UUID, UUID, TEXT, DECIMAL, DECIMAL, TEXT, UUID
    ) TO authenticated
  $sql$;
END $$;
