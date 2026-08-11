-- Catálogo nacional de medicamentos (SIAFAR/COFA + complemento a Alfabeta/PAMI).
-- Búsqueda unificada para cualquier cobertura: OS, prepaga, particular y PAMI.

CREATE TABLE IF NOT EXISTS national_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL,
  catalog_source TEXT NOT NULL DEFAULT 'siafar'
    CHECK (catalog_source IN ('siafar', 'anmat', 'manual')),
  active_ingredient TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  presentation TEXT NOT NULL,
  laboratory TEXT,
  reference_price NUMERIC(14, 2),
  source_updated_at DATE,
  source_file TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_key)
);

CREATE INDEX IF NOT EXISTS idx_national_medications_brand ON national_medications (brand_name);
CREATE INDEX IF NOT EXISTS idx_national_medications_ingredient ON national_medications (active_ingredient);
CREATE INDEX IF NOT EXISTS idx_national_medications_brand_trgm
  ON national_medications USING gin (brand_name gin_trgm_ops)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_national_medications_ingredient_trgm
  ON national_medications USING gin (active_ingredient gin_trgm_ops)
  WHERE is_active = true;

ALTER TABLE national_medications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY national_medications_clinical_select ON national_medications FOR SELECT
    USING (
      is_superadmin()
      OR EXISTS (
        SELECT 1 FROM clinic_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.is_active = true
          AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION search_medication_catalog(p_query TEXT, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  catalog_source TEXT,
  product_code TEXT,
  active_ingredient TEXT,
  brand_name TEXT,
  presentation TEXT,
  laboratory TEXT,
  reference_price NUMERIC,
  coverage_pct SMALLINT,
  affiliate_amount NUMERIC,
  price_list_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH term AS (
    SELECT lower(trim(p_query)) AS q
  ),
  alfabeta_rows AS (
    SELECT
      v.id,
      'alfabeta'::TEXT AS catalog_source,
      v.alfabeta_id::TEXT AS product_code,
      v.active_ingredient,
      v.brand_name,
      v.presentation,
      v.laboratory,
      v.pvp_amount AS reference_price,
      v.coverage_pct,
      v.affiliate_amount,
      v.price_list_date,
      CASE WHEN v.alfabeta_id::text = t.q THEN 0 ELSE 1 END AS rank_exact_code,
      CASE WHEN lower(v.brand_name) LIKE t.q || '%' THEN 0 ELSE 1 END AS rank_brand_prefix,
      CASE WHEN lower(v.active_ingredient) LIKE t.q || '%' THEN 0 ELSE 1 END AS rank_ingredient_prefix,
      CASE
        WHEN lower(v.active_ingredient) LIKE '%' || t.q || '%'
          OR lower(v.brand_name) LIKE '%' || t.q || '%'
        THEN 0
        ELSE 1
      END AS rank_substring,
      GREATEST(
        similarity(lower(v.active_ingredient), t.q),
        similarity(lower(v.brand_name), t.q),
        word_similarity(t.q, lower(v.active_ingredient)),
        word_similarity(t.q, lower(v.brand_name))
      ) AS rank_similarity
    FROM pami_vademecum v
    CROSS JOIN term t
    WHERE v.is_active = true
      AND length(t.q) >= 2
      AND (
        lower(v.brand_name) LIKE '%' || t.q || '%'
        OR lower(v.active_ingredient) LIKE '%' || t.q || '%'
        OR lower(v.laboratory) LIKE '%' || t.q || '%'
        OR lower(v.presentation) LIKE '%' || t.q || '%'
        OR v.alfabeta_id::text = t.q
        OR (
          length(t.q) >= 4
          AND (
            similarity(lower(v.active_ingredient), t.q) >= 0.32
            OR similarity(lower(v.brand_name), t.q) >= 0.32
            OR word_similarity(t.q, lower(v.active_ingredient)) >= 0.35
            OR word_similarity(t.q, lower(v.brand_name)) >= 0.35
          )
        )
      )
  ),
  national_rows AS (
    SELECT
      n.id,
      n.catalog_source,
      n.source_key AS product_code,
      n.active_ingredient,
      n.brand_name,
      n.presentation,
      n.laboratory,
      n.reference_price,
      NULL::SMALLINT AS coverage_pct,
      NULL::NUMERIC AS affiliate_amount,
      n.source_updated_at AS price_list_date,
      2 AS rank_exact_code,
      CASE WHEN lower(n.brand_name) LIKE t.q || '%' THEN 0 ELSE 1 END AS rank_brand_prefix,
      CASE WHEN lower(n.active_ingredient) LIKE t.q || '%' THEN 0 ELSE 1 END AS rank_ingredient_prefix,
      CASE
        WHEN lower(n.active_ingredient) LIKE '%' || t.q || '%'
          OR lower(n.brand_name) LIKE '%' || t.q || '%'
        THEN 0
        ELSE 1
      END AS rank_substring,
      GREATEST(
        similarity(lower(n.active_ingredient), t.q),
        similarity(lower(n.brand_name), t.q),
        word_similarity(t.q, lower(n.active_ingredient)),
        word_similarity(t.q, lower(n.brand_name))
      ) AS rank_similarity
    FROM national_medications n
    CROSS JOIN term t
    WHERE n.is_active = true
      AND length(t.q) >= 2
      AND NOT EXISTS (
        SELECT 1
        FROM pami_vademecum pv
        WHERE pv.is_active = true
          AND lower(pv.brand_name) = lower(n.brand_name)
          AND lower(pv.presentation) = lower(n.presentation)
      )
      AND (
        lower(n.brand_name) LIKE '%' || t.q || '%'
        OR lower(n.active_ingredient) LIKE '%' || t.q || '%'
        OR lower(n.laboratory) LIKE '%' || t.q || '%'
        OR lower(n.presentation) LIKE '%' || t.q || '%'
        OR (
          length(t.q) >= 4
          AND (
            similarity(lower(n.active_ingredient), t.q) >= 0.32
            OR similarity(lower(n.brand_name), t.q) >= 0.32
            OR word_similarity(t.q, lower(n.active_ingredient)) >= 0.35
            OR word_similarity(t.q, lower(n.brand_name)) >= 0.35
          )
        )
      )
  ),
  combined AS (
    SELECT * FROM alfabeta_rows
    UNION ALL
    SELECT * FROM national_rows
  )
  SELECT
    c.id,
    c.catalog_source,
    c.product_code,
    c.active_ingredient,
    c.brand_name,
    c.presentation,
    c.laboratory,
    c.reference_price,
    c.coverage_pct,
    c.affiliate_amount,
    c.price_list_date
  FROM combined c
  ORDER BY
    c.rank_exact_code,
    c.rank_brand_prefix,
    c.rank_ingredient_prefix,
    c.rank_substring,
    c.rank_similarity DESC,
    c.brand_name,
    c.presentation
  LIMIT LEAST(p_limit, 40);
$$;

CREATE OR REPLACE FUNCTION search_pami_vademecum(p_query TEXT, p_limit INTEGER DEFAULT 15)
RETURNS TABLE (
  id UUID,
  alfabeta_id INTEGER,
  active_ingredient TEXT,
  brand_name TEXT,
  presentation TEXT,
  laboratory TEXT,
  pvp_amount NUMERIC,
  coverage_pct SMALLINT,
  affiliate_amount NUMERIC,
  price_list_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mc.id,
    NULLIF(mc.product_code, '')::INTEGER AS alfabeta_id,
    mc.active_ingredient,
    mc.brand_name,
    mc.presentation,
    mc.laboratory,
    mc.reference_price AS pvp_amount,
    mc.coverage_pct,
    mc.affiliate_amount,
    mc.price_list_date
  FROM search_medication_catalog(p_query, p_limit) mc
  WHERE mc.catalog_source = 'alfabeta'
    AND mc.product_code ~ '^[0-9]+$';
$$;

GRANT EXECUTE ON FUNCTION search_medication_catalog(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_pami_vademecum(TEXT, INTEGER) TO authenticated;
