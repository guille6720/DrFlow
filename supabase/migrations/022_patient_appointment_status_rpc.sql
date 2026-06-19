-- Consulta pública de estado de turnos solicitados (portal pacientes).
CREATE OR REPLACE FUNCTION public.get_patient_appointment_statuses(
  p_slug TEXT,
  p_document_number TEXT,
  p_appointment_ids UUID[]
)
RETURNS TABLE (
  appointment_id UUID,
  status appointment_status,
  start_at TIMESTAMPTZ,
  booking_source TEXT
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
    a.booking_source
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  WHERE a.id = ANY(p_appointment_ids)
    AND a.clinic_id = v_clinic_id
    AND p.document_number = trim(p_document_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_appointment_statuses TO anon, authenticated;
