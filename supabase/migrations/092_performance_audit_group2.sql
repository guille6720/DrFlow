-- Performance audit Grupo 2 (092): turnos reportes aggregation RPC.

DO $$
BEGIN
  IF to_regclass('public.appointments') IS NULL THEN
    RAISE NOTICE '092: appointments missing — skip summarize_appointments_for_turnos_reportes';
    RETURN;
  END IF;

  EXECUTE $sql$
CREATE OR REPLACE FUNCTION public.summarize_appointments_for_turnos_reportes(
  p_clinic_id UUID,
  p_range_start TIMESTAMPTZ,
  p_range_end TIMESTAMPTZ,
  p_today_start TIMESTAMPTZ,
  p_today_end TIMESTAMPTZ,
  p_last7_start TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  WITH scoped AS (
    SELECT
      id,
      status,
      start_at,
      end_at,
      is_overbooking,
      professional_id
    FROM appointments
    WHERE clinic_id = p_clinic_id
      AND start_at >= p_range_start
      AND start_at < p_range_end
  ),
  today_rows AS (
    SELECT * FROM scoped
    WHERE start_at >= p_today_start AND start_at < p_today_end
  ),
  last30_rows AS (
    SELECT * FROM scoped
  ),
  last7_rows AS (
    SELECT * FROM scoped
    WHERE start_at >= p_last7_start
      AND start_at < p_today_end
      AND status <> 'cancelled'
  ),
  by_professional AS (
    SELECT professional_id, COUNT(*)::int AS cnt
    FROM today_rows
    GROUP BY professional_id
  )
  SELECT jsonb_build_object(
    'today', jsonb_build_object(
      'total', (SELECT COUNT(*)::int FROM today_rows),
      'pending', (SELECT COUNT(*)::int FROM today_rows WHERE status = 'pending'),
      'confirmed', (SELECT COUNT(*)::int FROM today_rows WHERE status = 'confirmed'),
      'attended', (SELECT COUNT(*)::int FROM today_rows WHERE status = 'attended'),
      'cancelled', (SELECT COUNT(*)::int FROM today_rows WHERE status = 'cancelled'),
      'no_show', (SELECT COUNT(*)::int FROM today_rows WHERE status = 'no_show'),
      'overbooking', (SELECT COUNT(*)::int FROM today_rows WHERE coalesce(is_overbooking, false))
    ),
    'last30_days', jsonb_build_object(
      'total', (SELECT COUNT(*)::int FROM last30_rows),
      'cancelled', (SELECT COUNT(*)::int FROM last30_rows WHERE status = 'cancelled'),
      'no_show', (SELECT COUNT(*)::int FROM last30_rows WHERE status = 'no_show'),
      'attended', (SELECT COUNT(*)::int FROM last30_rows WHERE status = 'attended')
    ),
    'last7_booked_minutes', COALESCE((
      SELECT SUM(
        GREATEST(
          0,
          ROUND(EXTRACT(EPOCH FROM (end_at - start_at)) / 60.0)
        )
      )::int
      FROM last7_rows
    ), 0),
    'by_professional_today', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'professional_id', professional_id,
          'count', cnt
        )
        ORDER BY cnt DESC
      )
      FROM by_professional
    ), '[]'::jsonb)
  );
$func$;
$sql$;

  EXECUTE $sql$
GRANT EXECUTE ON FUNCTION public.summarize_appointments_for_turnos_reportes(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
$sql$;
END $$;
