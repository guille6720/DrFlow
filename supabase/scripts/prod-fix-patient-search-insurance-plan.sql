-- Prod fix: add insurance_plan to search_patients_for_clinic RPC (migration 095).
-- Run in Supabase SQL Editor on production.

DROP FUNCTION IF EXISTS public.search_patients_for_clinic(UUID, TEXT, INT, BOOLEAN);
DROP FUNCTION IF EXISTS public.search_patients_for_clinic(UUID, TEXT, INT, BOOLEAN, INT);

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
  insurance_plan TEXT,
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
    p.insurance_plan,
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
