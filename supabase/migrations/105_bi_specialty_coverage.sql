-- Fase 4D: BI por especialidad / cobertura

CREATE OR REPLACE FUNCTION public.summarize_clinic_bi(
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
  WITH base AS (
    SELECT
      a.id,
      a.status,
      a.consultation_modality,
      COALESCE(NULLIF(TRIM(p.insurance_provider), ''), 'Sin cobertura') AS coverage,
      COALESCE(
        sp_appt.name,
        sp_pro.name,
        'Sin especialidad'
      ) AS specialty,
      COALESCE(loc.name, 'Sin sede') AS location_name
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    LEFT JOIN specialties sp_appt ON sp_appt.id = a.specialty_id
    LEFT JOIN professionals pro ON pro.id = a.professional_id
    LEFT JOIN specialties sp_pro ON sp_pro.id = pro.specialty_id
    LEFT JOIN locations loc ON loc.id = a.location_id
    WHERE a.clinic_id = p_clinic_id
      AND a.start_at >= p_start
      AND a.start_at < p_end
  ),
  attended AS (
    SELECT * FROM base WHERE status = 'attended'
  ),
  coverage_agg AS (
    SELECT coverage, COUNT(*)::int AS cnt
    FROM attended
    GROUP BY coverage
    ORDER BY cnt DESC
  ),
  specialty_agg AS (
    SELECT specialty, COUNT(*)::int AS cnt
    FROM attended
    GROUP BY specialty
    ORDER BY cnt DESC
  ),
  cross_agg AS (
    SELECT specialty, coverage, COUNT(*)::int AS cnt
    FROM attended
    GROUP BY specialty, coverage
    ORDER BY cnt DESC
  ),
  location_agg AS (
    SELECT location_name, COUNT(*)::int AS cnt
    FROM attended
    GROUP BY location_name
    ORDER BY cnt DESC
  ),
  stats AS (
    SELECT
      COUNT(*)::int AS total_scheduled,
      COUNT(*) FILTER (WHERE status = 'attended')::int AS attended,
      COUNT(*) FILTER (WHERE status = 'no_show')::int AS no_show,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (WHERE status = 'attended' AND consultation_modality = 'virtual')::int AS virtual,
      COUNT(*) FILTER (WHERE status = 'attended' AND consultation_modality IS DISTINCT FROM 'virtual')::int AS presencial
    FROM base
  )
  SELECT jsonb_build_object(
    'attended_total', (SELECT attended FROM stats),
    'unique_coverages', (SELECT COUNT(*)::int FROM coverage_agg),
    'unique_specialties', (SELECT COUNT(*)::int FROM specialty_agg),
    'appointment_stats', (
      SELECT jsonb_build_object(
        'total_scheduled', total_scheduled,
        'attended', attended,
        'no_show', no_show,
        'cancelled', cancelled,
        'presencial', presencial,
        'virtual', virtual,
        'attendance_rate',
          CASE WHEN total_scheduled > 0
            THEN ROUND((attended::numeric / total_scheduled) * 100, 1)
            ELSE 0
          END
      )
      FROM stats
    ),
    'by_coverage', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'coverage', coverage,
            'count', cnt,
            'pct', CASE WHEN (SELECT attended FROM stats) > 0
              THEN ROUND((cnt::numeric / (SELECT attended FROM stats)) * 100, 1)
              ELSE 0 END
          )
          ORDER BY cnt DESC
        )
        FROM coverage_agg
      ),
      '[]'::jsonb
    ),
    'by_specialty', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'specialty', specialty,
            'count', cnt,
            'pct', CASE WHEN (SELECT attended FROM stats) > 0
              THEN ROUND((cnt::numeric / (SELECT attended FROM stats)) * 100, 1)
              ELSE 0 END
          )
          ORDER BY cnt DESC
        )
        FROM specialty_agg
      ),
      '[]'::jsonb
    ),
    'by_specialty_coverage', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('specialty', specialty, 'coverage', coverage, 'count', cnt)
          ORDER BY cnt DESC
        )
        FROM cross_agg
      ),
      '[]'::jsonb
    ),
    'by_location', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'location', location_name,
            'count', cnt,
            'pct', CASE WHEN (SELECT attended FROM stats) > 0
              THEN ROUND((cnt::numeric / (SELECT attended FROM stats)) * 100, 1)
              ELSE 0 END
          )
          ORDER BY cnt DESC
        )
        FROM location_agg
      ),
      '[]'::jsonb
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.summarize_clinic_bi(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.summarize_clinic_bi IS 'BI Fase 4D: atenciones por cobertura, especialidad, sede y cruce especialidad×cobertura.';
