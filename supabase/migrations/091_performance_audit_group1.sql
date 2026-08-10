-- Performance audit Grupo 1 (091): paginated patient search + cash closure aggregation RPCs.

-- ---------------------------------------------------------------------------
-- 1. Extend patient search RPC with offset (list pagination) and count helper
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.search_patients_for_clinic(UUID, TEXT, INT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.search_patients_for_clinic(
  p_clinic_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_pami_only BOOLEAN DEFAULT FALSE,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  document_number TEXT,
  birth_date DATE,
  insurance_provider TEXT,
  insurance_number TEXT,
  phone TEXT,
  address TEXT,
  email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_q TEXT;
  v_q_digits TEXT;
  v_limit INT;
  v_offset INT;
BEGIN
  v_q := trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'));
  IF v_q = '' THEN
    RETURN;
  END IF;

  IF length(v_q) > 80 THEN
    v_q := left(v_q, 80);
  END IF;

  v_q_digits := normalize_patient_document(v_q);
  v_limit := LEAST(GREATEST(coalesce(p_limit, 20), 1), 500);
  v_offset := GREATEST(coalesce(p_offset, 0), 0);

  RETURN QUERY
  WITH params AS (
    SELECT
      v_q AS q,
      v_q_digits AS q_digits,
      v_limit AS lim,
      v_offset AS off
  )
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.document_number,
    p.birth_date,
    p.insurance_provider,
    p.insurance_number,
    p.phone,
    p.address,
    p.email
  FROM patients p
  CROSS JOIN params par
  WHERE p.clinic_id = p_clinic_id
    AND p.is_active = true
    AND (NOT p_pami_only OR p.insurance_provider ILIKE '%PAMI%')
    AND (
      (
        par.q_digits <> ''
        AND par.q ~ '^[\d.\-\s]+$'
        AND normalize_patient_document(p.document_number) = par.q_digits
      )
      OR
      (
        length(par.q_digits) >= 3
        AND normalize_patient_document(p.document_number) LIKE par.q_digits || '%'
      )
      OR
      (
        length(par.q) = 1
        AND par.q ~ '^[[:alpha:]]$'
        AND p.last_name ILIKE public.escape_ilike_pattern(par.q) || '%'
      )
      OR
      (
        length(par.q) >= 2
        AND (
          SELECT bool_and(
            p.first_name ILIKE '%' || public.escape_ilike_pattern(tok) || '%'
            OR p.last_name ILIKE '%' || public.escape_ilike_pattern(tok) || '%'
            OR p.document_number ILIKE '%' || public.escape_ilike_pattern(tok) || '%'
            OR coalesce(p.phone, '') ILIKE '%' || public.escape_ilike_pattern(tok) || '%'
            OR (
              tok ~ '^\d+$'
              AND length(tok) >= 3
              AND normalize_patient_phone(p.phone) LIKE '%' || tok || '%'
            )
          )
          FROM unnest(string_to_array(par.q, ' ')) AS tok
          WHERE tok <> ''
        )
      )
    )
  ORDER BY
    CASE
      WHEN par.q_digits <> '' AND normalize_patient_document(p.document_number) = par.q_digits THEN 0
      ELSE 1
    END,
    p.last_name,
    p.first_name
  OFFSET v_offset
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_patients_for_clinic(UUID, TEXT, INT, BOOLEAN, INT)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.count_patients_for_clinic_search(
  p_clinic_id UUID,
  p_query TEXT,
  p_pami_only BOOLEAN DEFAULT FALSE
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_q TEXT;
  v_q_digits TEXT;
BEGIN
  v_q := trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'));
  IF v_q = '' THEN
    RETURN 0;
  END IF;

  IF length(v_q) > 80 THEN
    v_q := left(v_q, 80);
  END IF;

  v_q_digits := normalize_patient_document(v_q);

  RETURN (
    SELECT COUNT(*)::bigint
    FROM patients p
    WHERE p.clinic_id = p_clinic_id
      AND p.is_active = true
      AND (NOT p_pami_only OR p.insurance_provider ILIKE '%PAMI%')
      AND (
        (
          v_q_digits <> ''
          AND v_q ~ '^[\d.\-\s]+$'
          AND normalize_patient_document(p.document_number) = v_q_digits
        )
        OR
        (
          length(v_q_digits) >= 3
          AND normalize_patient_document(p.document_number) LIKE v_q_digits || '%'
        )
        OR
        (
          length(v_q) = 1
          AND v_q ~ '^[[:alpha:]]$'
          AND p.last_name ILIKE public.escape_ilike_pattern(v_q) || '%'
        )
        OR
        (
          length(v_q) >= 2
          AND (
            SELECT bool_and(
              p.first_name ILIKE '%' || public.escape_ilike_pattern(tok) || '%'
              OR p.last_name ILIKE '%' || public.escape_ilike_pattern(tok) || '%'
              OR p.document_number ILIKE '%' || public.escape_ilike_pattern(tok) || '%'
              OR coalesce(p.phone, '') ILIKE '%' || public.escape_ilike_pattern(tok) || '%'
              OR (
                tok ~ '^\d+$'
                AND length(tok) >= 3
                AND normalize_patient_phone(p.phone) LIKE '%' || tok || '%'
              )
            )
            FROM unnest(string_to_array(v_q, ' ')) AS tok
            WHERE tok <> ''
          )
        )
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_patients_for_clinic_search(UUID, TEXT, BOOLEAN)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cash closure day totals — single aggregation instead of fetch-all
-- (requires migration 034 cash_charges; skipped when table missing)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.cash_charges') IS NULL THEN
    RAISE NOTICE '091: cash_charges missing — skip summarize_collected_cash_charges_for_closure (apply migration 034)';
    RETURN;
  END IF;

  EXECUTE $sql$
CREATE OR REPLACE FUNCTION public.summarize_collected_cash_charges_for_closure(
  p_clinic_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT jsonb_build_object(
    'general', COALESCE(SUM(amount), 0),
    'particular', COALESCE(SUM(amount) FILTER (WHERE charge_kind = 'consulta_particular'), 0),
    'copago', COALESCE(SUM(amount) FILTER (WHERE charge_kind = 'copago_autorizado'), 0),
    'coseguro', COALESCE(SUM(amount) FILTER (WHERE charge_kind = 'coseguro_autorizado'), 0),
    'art', COALESCE(SUM(amount) FILTER (WHERE attention_type = 'art'), 0),
    'obra_social', COALESCE(SUM(amount) FILTER (WHERE attention_type = 'obra_social'), 0),
    'cash', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash'), 0),
    'debit', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'debit'), 0),
    'credit', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'credit'), 0),
    'transfer', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'transfer'), 0),
    'mercadopago', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'mercadopago'), 0),
    'qr', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'qr'), 0),
    'account', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'account'), 0),
    'patient_count', COUNT(DISTINCT patient_id),
    'consultation_count', COUNT(*)
  )
  FROM cash_charges
  WHERE clinic_id = p_clinic_id
    AND status = 'collected'
    AND charged_at >= p_from
    AND charged_at <= p_to;
$func$;
$sql$;

  EXECUTE $sql$
GRANT EXECUTE ON FUNCTION public.summarize_collected_cash_charges_for_closure(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
$sql$;
END $$;
