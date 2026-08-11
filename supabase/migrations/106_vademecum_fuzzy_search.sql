-- Fuzzy vademécum search: tolerate typos (e.g. rosubastatina → rosuvastatina).
-- Uses pg_trgm (061) + indexes on active_ingredient / brand_name (088).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
  WITH term AS (
    SELECT lower(trim(p_query)) AS q
  )
  SELECT
    v.id,
    v.alfabeta_id,
    v.active_ingredient,
    v.brand_name,
    v.presentation,
    v.laboratory,
    v.pvp_amount,
    v.coverage_pct,
    v.affiliate_amount,
    v.price_list_date
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
  ORDER BY
    CASE WHEN v.alfabeta_id::text = t.q THEN 0 ELSE 1 END,
    CASE WHEN lower(v.brand_name) LIKE t.q || '%' THEN 0 ELSE 1 END,
    CASE WHEN lower(v.active_ingredient) LIKE t.q || '%' THEN 0 ELSE 1 END,
    CASE
      WHEN lower(v.active_ingredient) LIKE '%' || t.q || '%'
        OR lower(v.brand_name) LIKE '%' || t.q || '%'
      THEN 0
      ELSE 1
    END,
    GREATEST(
      similarity(lower(v.active_ingredient), t.q),
      similarity(lower(v.brand_name), t.q),
      word_similarity(t.q, lower(v.active_ingredient)),
      word_similarity(t.q, lower(v.brand_name))
    ) DESC,
    v.brand_name,
    v.presentation
  LIMIT LEAST(p_limit, 30);
$$;

GRANT EXECUTE ON FUNCTION search_pami_vademecum(TEXT, INTEGER) TO authenticated;
