-- Cancelación de turnos con registro + reenvío de link app pacientes.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by_type TEXT;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_cancelled_by_type_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_cancelled_by_type_check
  CHECK (cancelled_by_type IS NULL OR cancelled_by_type IN ('patient', 'clinic'));

-- Permitir reenviar link de app (actualizar registro existente).
ALTER TABLE patient_app_share_log DROP CONSTRAINT IF EXISTS patient_app_share_log_patient_unique;

DROP POLICY IF EXISTS patient_app_share_log_update ON patient_app_share_log;
CREATE POLICY patient_app_share_log_update ON patient_app_share_log
  FOR UPDATE
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

DROP FUNCTION IF EXISTS public.get_patient_appointment_statuses(text, text, uuid[]);

CREATE OR REPLACE FUNCTION public.get_patient_appointment_statuses(
  p_slug TEXT,
  p_document_number TEXT,
  p_appointment_ids UUID[]
)
RETURNS TABLE (
  appointment_id UUID,
  status appointment_status,
  start_at TIMESTAMPTZ,
  booking_source TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
BEGIN
  IF p_appointment_ids IS NULL OR array_length(p_appointment_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT c.id INTO v_clinic_id
  FROM clinics c
  WHERE c.slug = p_slug AND c.is_active = true;

  IF v_clinic_id IS NULL THEN
    SELECT bl.clinic_id INTO v_clinic_id
    FROM public_booking_links bl
    WHERE bl.slug = p_slug AND bl.is_active = true;
  END IF;

  IF v_clinic_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.status,
    a.start_at,
    a.booking_source,
    a.cancellation_reason,
    a.cancelled_at,
    a.cancelled_by_type
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  WHERE a.id = ANY(p_appointment_ids)
    AND a.clinic_id = v_clinic_id
    AND p.document_number = trim(p_document_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_appointment_statuses TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_patient_appointment(
  p_slug TEXT,
  p_document_number TEXT,
  p_appointment_id UUID,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
  v_reason TEXT := trim(p_reason);
BEGIN
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;

  SELECT c.id INTO v_clinic_id
  FROM clinics c
  WHERE c.slug = p_slug AND c.is_active = true;

  IF v_clinic_id IS NULL THEN
    SELECT bl.clinic_id INTO v_clinic_id
    FROM public_booking_links bl
    WHERE bl.slug = p_slug AND bl.is_active = true;
  END IF;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  UPDATE appointments a
  SET
    status = 'cancelled'::appointment_status,
    cancellation_reason = v_reason,
    cancelled_at = now(),
    cancelled_by_type = 'patient',
    cancelled_by = NULL,
    updated_at = now()
  FROM patients p
  WHERE a.id = p_appointment_id
    AND a.patient_id = p.id
    AND a.clinic_id = v_clinic_id
    AND p.document_number = trim(p_document_number)
    AND a.status IN ('pending'::appointment_status, 'confirmed'::appointment_status);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_patient_appointment TO anon, authenticated;
