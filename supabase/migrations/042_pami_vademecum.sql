-- Vademécum PAMI / Alfabeta (productos comerciales con cobertura y precios)

CREATE TABLE IF NOT EXISTS pami_vademecum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alfabeta_id INTEGER NOT NULL,
  active_ingredient TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  presentation TEXT NOT NULL,
  laboratory TEXT,
  pvp_amount NUMERIC(14, 2),
  coverage_pct SMALLINT,
  affiliate_amount NUMERIC(14, 2),
  price_list_date DATE,
  source_file TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (alfabeta_id, presentation)
);

CREATE INDEX IF NOT EXISTS idx_pami_vademecum_brand ON pami_vademecum (brand_name);
CREATE INDEX IF NOT EXISTS idx_pami_vademecum_ingredient ON pami_vademecum (active_ingredient);
CREATE INDEX IF NOT EXISTS idx_pami_vademecum_lab ON pami_vademecum (laboratory);
CREATE INDEX IF NOT EXISTS idx_pami_vademecum_alfabeta ON pami_vademecum (alfabeta_id);

ALTER TABLE pami_vademecum ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY pami_vademecum_clinical_select ON pami_vademecum FOR SELECT
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
  WHERE v.is_active = true
    AND length(trim(p_query)) >= 2
    AND (
      v.brand_name ILIKE '%' || trim(p_query) || '%'
      OR v.active_ingredient ILIKE '%' || trim(p_query) || '%'
      OR v.laboratory ILIKE '%' || trim(p_query) || '%'
      OR v.presentation ILIKE '%' || trim(p_query) || '%'
      OR v.alfabeta_id::text = trim(p_query)
    )
  ORDER BY
    CASE WHEN v.alfabeta_id::text = trim(p_query) THEN 0 ELSE 1 END,
    CASE WHEN v.brand_name ILIKE trim(p_query) || '%' THEN 0 ELSE 1 END,
    CASE WHEN v.active_ingredient ILIKE trim(p_query) || '%' THEN 0 ELSE 1 END,
    v.brand_name,
    v.presentation
  LIMIT LEAST(p_limit, 30);
$$;

GRANT EXECUTE ON FUNCTION search_pami_vademecum(TEXT, INTEGER) TO authenticated;
