-- ReNaPDiS Phase 1 readiness: additive professional identity / REFEPS validation fields.
-- Staging-oriented. Does NOT invent Ministry endpoints or CUIR algorithms.
-- Does NOT rewrite prior migrations. Preserves existing RLS on professionals.

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS cuil text,
  ADD COLUMN IF NOT EXISTS refeps_identifier text,
  ADD COLUMN IF NOT EXISTS licensing_jurisdiction text,
  ADD COLUMN IF NOT EXISTS issuing_authority text,
  ADD COLUMN IF NOT EXISTS refeps_specialty text,
  ADD COLUMN IF NOT EXISTS refeps_validation_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS refeps_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS refeps_validation_error text,
  ADD COLUMN IF NOT EXISTS refeps_validation_details jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'professionals_refeps_validation_status_check'
      AND conrelid = 'public.professionals'::regclass
  ) THEN
    ALTER TABLE public.professionals
      ADD CONSTRAINT professionals_refeps_validation_status_check
      CHECK (
        refeps_validation_status IN (
          'sandbox',
          'validated',
          'pending',
          'failed',
          'not_configured'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.professionals.cuil IS
  'CUIL del profesional para identidad ReNaPDiS / REFEPS (Phase 1).';
COMMENT ON COLUMN public.professionals.refeps_identifier IS
  'Identificador REFEPS del profesional cuando esté disponible. Placeholder hasta especificación oficial.';
COMMENT ON COLUMN public.professionals.licensing_jurisdiction IS
  'Jurisdicción de matrícula (p.ej. CABA, Provincia).';
COMMENT ON COLUMN public.professionals.issuing_authority IS
  'Autoridad emisora de la matrícula.';
COMMENT ON COLUMN public.professionals.refeps_specialty IS
  'Especialidad declarada para validación REFEPS (texto libre Phase 1).';
COMMENT ON COLUMN public.professionals.refeps_validation_status IS
  'Estado de validación REFEPS: sandbox | validated | pending | failed | not_configured.';
COMMENT ON COLUMN public.professionals.refeps_validated_at IS
  'Último timestamp de validación (éxito sandbox/oficial o fallo registrado).';
COMMENT ON COLUMN public.professionals.refeps_validation_error IS
  'Detalle de error de la última validación fallida.';
COMMENT ON COLUMN public.professionals.refeps_validation_details IS
  'Detalles no secretos de la última validación (adaptador, modo, mensajes). Sin inventar payload ministerial.';

CREATE INDEX IF NOT EXISTS idx_professionals_clinic_refeps_status
  ON public.professionals (clinic_id, refeps_validation_status)
  WHERE is_active = true;
