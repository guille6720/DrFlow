-- CIE-10-ES catalog import support for clinical_diagnoses (global catalog).
-- Staging-only apply; does not touch production. Additive / idempotent.

ALTER TABLE clinical_diagnoses
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_version TEXT,
  ADD COLUMN IF NOT EXISTS parent_code TEXT,
  ADD COLUMN IF NOT EXISTS level SMALLINT;

COMMENT ON COLUMN clinical_diagnoses.source IS
  'Proveniencia del registro (ej. cie10-es-lista-tabular-enfermedades-pdf). NULL = seed/manual.';
COMMENT ON COLUMN clinical_diagnoses.source_version IS
  'Versión del origen (ej. CIE-10-ES 6a edicion enero 2026 extracto).';
COMMENT ON COLUMN clinical_diagnoses.parent_code IS
  'Código CIE-10 padre cuando aplica (jerarquía tabular).';
COMMENT ON COLUMN clinical_diagnoses.level IS
  'Nivel jerárquico aproximado del código CIE-10 (3=categoría, 4+=subcategorías).';

-- One row per CIE-10 code for the official import source (seed rows keep source NULL).
CREATE UNIQUE INDEX IF NOT EXISTS clinical_diagnoses_cie10_import_uidx
  ON clinical_diagnoses (cie10_code)
  WHERE source = 'cie10-es-lista-tabular-enfermedades-pdf'
    AND cie10_code IS NOT NULL
    AND trim(cie10_code) <> '';

CREATE INDEX IF NOT EXISTS idx_clinical_diagnoses_source
  ON clinical_diagnoses (source)
  WHERE source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_diagnoses_parent_code
  ON clinical_diagnoses (parent_code)
  WHERE parent_code IS NOT NULL AND trim(parent_code) <> '';

-- Slightly broaden code search: allow partial match anywhere in cie10_code (still accent-folded query).
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
BEGIN
  IF auth.uid() IS NULL AND NOT is_superadmin() THEN
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

GRANT EXECUTE ON FUNCTION public.search_clinical_diagnoses(TEXT, INTEGER) TO authenticated;
