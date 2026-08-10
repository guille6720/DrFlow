-- Aggregation RPCs for query optimization (replaces fetch-all-then-count in app code).
-- cash_charges RPC skipped when migration 034 was not applied (see 091 pattern).

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

DO $$
BEGIN
  IF to_regclass('public.cash_charges') IS NULL THEN
    RAISE NOTICE '064: cash_charges missing — skip sum_collected_cash_charges (apply migration 034)';
    RETURN;
  END IF;

  EXECUTE $sql$
CREATE OR REPLACE FUNCTION public.sum_collected_cash_charges(
  p_clinic_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  total NUMERIC,
  charge_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(*)
  FROM cash_charges
  WHERE clinic_id = p_clinic_id
    AND status = 'collected'
    AND charged_at >= p_from
    AND charged_at <= p_to;
$func$;
$sql$;

  EXECUTE $sql$
GRANT EXECUTE ON FUNCTION public.sum_collected_cash_charges(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
$sql$;
END $$;

DO $$
BEGIN
  IF to_regclass('public.payments') IS NULL THEN
    RAISE NOTICE '064: payments missing — skip sum_paid_payments';
    RETURN;
  END IF;

  EXECUTE $sql$
CREATE OR REPLACE FUNCTION public.sum_paid_payments(
  p_clinic_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT COALESCE(SUM(amount), 0)
  FROM payments
  WHERE clinic_id = p_clinic_id
    AND status = 'paid'
    AND created_at >= p_from
    AND created_at <= p_to;
$func$;
$sql$;

  EXECUTE $sql$
GRANT EXECUTE ON FUNCTION public.sum_paid_payments(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
$sql$;
END $$;
