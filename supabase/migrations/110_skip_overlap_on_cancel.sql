-- Skip overlap checks when an appointment is being cancelled.

CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.professional_id = NEW.professional_id
      AND a.id IS DISTINCT FROM NEW.id
      AND a.status NOT IN ('cancelled')
      AND a.start_at < NEW.end_at
      AND a.end_at > NEW.start_at
  ) THEN
    PERFORM raise_app_error(
      'APPOINTMENT_SLOT_CONFLICT',
      'El profesional ya tiene un turno en ese horario'
    );
  END IF;
  RETURN NEW;
END;
$$;
