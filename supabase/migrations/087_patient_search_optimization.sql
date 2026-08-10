-- Patient search optimization: centralized RPC + targeted indexes for DNI/phone/name.
-- Idempotent. Maps to /api/patients/search and command palette patient lookup.

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.escape_ilike_pattern(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT replace(replace(replace(coalesce(p_text, ''), '\', '\\'), '%', '\%'), '_', '\_');
$$;

CREATE OR REPLACE FUNCTION public.normalize_patient_document(p_document TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT regexp_replace(coalesce(p_document, ''), '\D', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.normalize_patient_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
$$;

-- ---------------------------------------------------------------------------
-- 2. Indexes (query-driven; pg_trgm already covers first/last/document from 061)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_patients_clinic_document_digits
  ON patients (clinic_id, (normalize_patient_document(document_number)))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm
  ON patients USING gin (phone gin_trgm_ops)
  WHERE is_active = true AND phone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. RPC — server-side patient search for a clinic (RLS via SECURITY INVOKER)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_patients_for_clinic(
  p_clinic_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_pami_only BOOLEAN DEFAULT FALSE
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
  address TEXT
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
BEGIN
  v_q := trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'));
  IF v_q = '' THEN
    RETURN;
  END IF;

  IF length(v_q) > 80 THEN
    v_q := left(v_q, 80);
  END IF;

  v_q_digits := normalize_patient_document(v_q);
  v_limit := LEAST(GREATEST(coalesce(p_limit, 20), 1), 50);

  RETURN QUERY
  WITH params AS (
    SELECT
      v_q AS q,
      v_q_digits AS q_digits,
      v_limit AS lim
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
    p.address
  FROM patients p
  CROSS JOIN params par
  WHERE p.clinic_id = p_clinic_id
    AND p.is_active = true
    AND (NOT p_pami_only OR p.insurance_provider ILIKE '%PAMI%')
    AND (
      -- Exact DNI (numeric query)
      (
        par.q_digits <> ''
        AND par.q ~ '^[\d.\-\s]+$'
        AND normalize_patient_document(p.document_number) = par.q_digits
      )
      OR
      -- Partial DNI prefix (3+ digits)
      (
        length(par.q_digits) >= 3
        AND normalize_patient_document(p.document_number) LIKE par.q_digits || '%'
      )
      OR
      -- Single-letter last name prefix
      (
        length(par.q) = 1
        AND par.q ~ '^[[:alpha:]]$'
        AND p.last_name ILIKE public.escape_ilike_pattern(par.q) || '%'
      )
      OR
      -- Multi-field token AND (name, last name, document, phone)
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
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_patients_for_clinic(UUID, TEXT, INT, BOOLEAN) TO authenticated;
