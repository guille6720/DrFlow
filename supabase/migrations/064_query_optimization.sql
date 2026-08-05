-- Aggregation RPCs for query optimization (replaces fetch-all-then-count in app code).

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
AS $$
  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(*)
  FROM cash_charges
  WHERE clinic_id = p_clinic_id
    AND status = 'collected'
    AND charged_at >= p_from
    AND charged_at <= p_to;
$$;

GRANT EXECUTE ON FUNCTION public.sum_collected_cash_charges(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;

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
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM payments
  WHERE clinic_id = p_clinic_id
    AND status = 'paid'
    AND created_at >= p_from
    AND created_at <= p_to;
$$;

GRANT EXECUTE ON FUNCTION public.sum_paid_payments(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
