-- Ejecutar en Supabase SQL Editor (PRODUCTION) cuando 064 falla por cash_charges ausente.
-- Solo crea el RPC de conteo de consultas por paciente (listado /pacientes).

CREATE OR REPLACE FUNCTION public.count_clinical_records_by_patients(
  p_clinic_id UUID,
  p_patient_ids UUID[]
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('patient_id', patient_id, 'count', cnt)
      ORDER BY patient_id
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT cr.patient_id, COUNT(*)::int AS cnt
    FROM clinical_records cr
    WHERE cr.clinic_id = p_clinic_id
      AND cr.patient_id = ANY (p_patient_ids)
    GROUP BY cr.patient_id
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION public.count_clinical_records_by_patients(UUID, UUID[])
  TO authenticated;

-- Verificación rápida (reemplazá el UUID de clínica y paciente por uno real):
-- SELECT public.count_clinical_records_by_patients(
--   'TU-CLINIC-ID'::uuid,
--   ARRAY['TU-PATIENT-ID'::uuid]
-- );
