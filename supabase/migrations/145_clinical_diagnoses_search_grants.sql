-- Fix diagnosis catalog search for authenticated staff after EXECUTE/RLS hardening.
-- 1) RLS SELECT must not call is_superadmin() (authenticated may lack EXECUTE).
-- 2) Re-assert RPC EXECUTE for authenticated + service_role (server actions).

DROP POLICY IF EXISTS clinical_diagnoses_select ON clinical_diagnoses;
CREATE POLICY clinical_diagnoses_select ON clinical_diagnoses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_superadmin = true
    )
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
    )
  );

CREATE OR REPLACE FUNCTION public.search_clinical_diagnoses(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  normalized_name TEXT,
  snomed_code TEXT,
  cie10_code TEXT,
  cie11_code TEXT,
  category TEXT,
  synonyms TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q TEXT := public.immutable_unaccent(trim(coalesce(p_query, '')));
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 10), 25));
  v_role TEXT := COALESCE(auth.jwt()->>'role', '');
BEGIN
  IF auth.uid() IS NULL AND v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF length(v_q) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.normalized_name,
    d.snomed_code,
    d.cie10_code,
    d.cie11_code,
    d.category,
    d.synonyms
  FROM clinical_diagnoses d
  WHERE d.active = true
    AND (
      d.normalized_name LIKE '%' || v_q || '%'
      OR public.immutable_unaccent(d.name) LIKE '%' || v_q || '%'
      OR EXISTS (
        SELECT 1
        FROM unnest(d.synonyms) AS syn(s)
        WHERE public.immutable_unaccent(syn.s) LIKE '%' || v_q || '%'
      )
      OR (d.cie10_code IS NOT NULL AND lower(d.cie10_code) LIKE '%' || v_q || '%')
      OR (d.snomed_code IS NOT NULL AND lower(d.snomed_code) LIKE v_q || '%')
    )
  ORDER BY
    CASE
      WHEN d.cie10_code IS NOT NULL AND lower(d.cie10_code) = v_q THEN 0
      WHEN d.cie10_code IS NOT NULL AND lower(d.cie10_code) LIKE v_q || '%' THEN 1
      WHEN d.normalized_name LIKE v_q || '%' THEN 2
      WHEN EXISTS (
        SELECT 1 FROM unnest(d.synonyms) AS syn(s)
        WHERE public.immutable_unaccent(syn.s) LIKE v_q || '%'
      ) THEN 3
      ELSE 4
    END,
    length(d.name),
    d.name
  LIMIT v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_clinical_diagnoses(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_clinical_diagnoses(TEXT, INTEGER) TO authenticated, service_role;
