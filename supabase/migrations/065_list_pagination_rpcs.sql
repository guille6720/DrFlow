-- RPCs for paginated list views: aggregate stats without fetch-all.

CREATE OR REPLACE FUNCTION public.summarize_attended_appointments(
  p_clinic_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH attended AS (
    SELECT
      a.patient_id,
      a.consultation_modality,
      COALESCE(NULLIF(TRIM(p.insurance_provider), ''), 'Sin cobertura') AS coverage
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    WHERE a.clinic_id = p_clinic_id
      AND a.status = 'attended'
      AND a.start_at >= p_start
      AND a.start_at < p_end
  ),
  coverage AS (
    SELECT coverage, COUNT(*)::int AS cnt
    FROM attended
    GROUP BY coverage
    ORDER BY cnt DESC
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*)::int FROM attended),
    'presencial', (SELECT COUNT(*)::int FROM attended WHERE consultation_modality IS DISTINCT FROM 'virtual'),
    'virtual', (SELECT COUNT(*)::int FROM attended WHERE consultation_modality = 'virtual'),
    'unique_patients', (SELECT COUNT(DISTINCT patient_id)::int FROM attended),
    'by_coverage', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('coverage', coverage, 'count', cnt) ORDER BY cnt DESC) FROM coverage),
      '[]'::jsonb
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.summarize_attended_appointments(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.count_clinical_records_by_professional(
  p_clinic_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', COALESCE(pr.full_name, 'Sin asignar'),
        'count', sub.cnt
      )
      ORDER BY sub.cnt DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT
      cr.professional_id,
      COUNT(*)::int AS cnt
    FROM clinical_records cr
    WHERE cr.clinic_id = p_clinic_id
      AND cr.created_at >= p_from
      AND (p_to IS NULL OR cr.created_at <= p_to)
    GROUP BY cr.professional_id
  ) sub
  LEFT JOIN professionals pro ON pro.id = sub.professional_id
  LEFT JOIN profiles pr ON pr.id = pro.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.count_clinical_records_by_professional(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
