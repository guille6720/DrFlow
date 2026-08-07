-- PAMI planilla catalog: categories, versioned templates, dynamic fields.
-- Replaces hardcoded TS constants; renderPamiPlanilla() contract unchanged.

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pami_planilla_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pami_planilla_categories_slug_nonempty CHECK (char_length(trim(slug)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pami_planilla_categories_global_slug
  ON pami_planilla_categories (slug)
  WHERE clinic_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pami_planilla_categories_clinic_slug
  ON pami_planilla_categories (clinic_id, slug)
  WHERE clinic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pami_planilla_categories_active
  ON pami_planilla_categories (is_active, sort_order)
  WHERE clinic_id IS NULL;

-- ---------------------------------------------------------------------------
-- Templates (logical entity; body lives in versions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pami_planilla_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES pami_planilla_categories(id) ON DELETE RESTRICT,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  current_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pami_planilla_templates_slug_nonempty CHECK (char_length(trim(slug)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pami_planilla_templates_global_slug
  ON pami_planilla_templates (slug)
  WHERE clinic_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pami_planilla_templates_clinic_slug
  ON pami_planilla_templates (clinic_id, slug)
  WHERE clinic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pami_planilla_templates_category_active
  ON pami_planilla_templates (category_id, is_active, sort_order);

-- ---------------------------------------------------------------------------
-- Immutable version snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pami_planilla_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES pami_planilla_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  body_template TEXT NOT NULL,
  change_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number),
  CONSTRAINT pami_planilla_template_versions_body_nonempty
    CHECK (char_length(trim(body_template)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_pami_planilla_template_versions_template
  ON pami_planilla_template_versions (template_id, version_number DESC);

-- ---------------------------------------------------------------------------
-- Dynamic fields per version
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pami_planilla_template_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES pami_planilla_template_versions(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  multiline BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (version_id, field_key),
  CONSTRAINT pami_planilla_template_fields_key_format
    CHECK (field_key ~ '^[a-z][a-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS idx_pami_planilla_template_fields_version
  ON pami_planilla_template_fields (version_id, sort_order);

ALTER TABLE pami_planilla_templates
  DROP CONSTRAINT IF EXISTS fk_pami_planilla_templates_current_version;

ALTER TABLE pami_planilla_templates
  ADD CONSTRAINT fk_pami_planilla_templates_current_version
  FOREIGN KEY (current_version_id)
  REFERENCES pami_planilla_template_versions(id)
  ON DELETE SET NULL;

-- Per-clinic enable/disable without forking global templates
CREATE TABLE IF NOT EXISTS pami_planilla_clinic_template_settings (
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES pami_planilla_templates(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_pami_planilla_clinic_settings_clinic
  ON pami_planilla_clinic_template_settings (clinic_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE pami_planilla_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pami_planilla_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pami_planilla_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pami_planilla_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE pami_planilla_clinic_template_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY pami_planilla_categories_select ON pami_planilla_categories FOR SELECT
  USING (
    is_superadmin()
    OR clinic_id IS NULL
    OR clinic_id IN (SELECT user_clinic_ids())
  );

CREATE POLICY pami_planilla_categories_manage ON pami_planilla_categories FOR ALL
  USING (
    is_superadmin()
    OR (clinic_id IS NOT NULL AND can_manage_clinic(clinic_id))
  );

CREATE POLICY pami_planilla_templates_select ON pami_planilla_templates FOR SELECT
  USING (
    is_superadmin()
    OR clinic_id IS NULL
    OR clinic_id IN (SELECT user_clinic_ids())
  );

CREATE POLICY pami_planilla_templates_manage ON pami_planilla_templates FOR ALL
  USING (
    is_superadmin()
    OR (clinic_id IS NOT NULL AND can_manage_clinic(clinic_id))
  );

CREATE POLICY pami_planilla_versions_select ON pami_planilla_template_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pami_planilla_templates t
      WHERE t.id = template_id
        AND (
          is_superadmin()
          OR t.clinic_id IS NULL
          OR t.clinic_id IN (SELECT user_clinic_ids())
        )
    )
  );

CREATE POLICY pami_planilla_versions_manage ON pami_planilla_template_versions FOR ALL
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM pami_planilla_templates t
      WHERE t.id = template_id
        AND t.clinic_id IS NOT NULL
        AND can_manage_clinic(t.clinic_id)
    )
  );

CREATE POLICY pami_planilla_fields_select ON pami_planilla_template_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM pami_planilla_template_versions v
      JOIN pami_planilla_templates t ON t.id = v.template_id
      WHERE v.id = version_id
        AND (
          is_superadmin()
          OR t.clinic_id IS NULL
          OR t.clinic_id IN (SELECT user_clinic_ids())
        )
    )
  );

CREATE POLICY pami_planilla_fields_manage ON pami_planilla_template_fields FOR ALL
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM pami_planilla_template_versions v
      JOIN pami_planilla_templates t ON t.id = v.template_id
      WHERE v.id = version_id
        AND t.clinic_id IS NOT NULL
        AND can_manage_clinic(t.clinic_id)
    )
  );

CREATE POLICY pami_planilla_clinic_settings_select ON pami_planilla_clinic_template_settings FOR SELECT
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY pami_planilla_clinic_settings_manage ON pami_planilla_clinic_template_settings FOR ALL
  USING (can_manage_clinic(clinic_id) OR is_superadmin());

-- Superadmin can manage global catalog
CREATE POLICY pami_planilla_categories_global_manage ON pami_planilla_categories FOR ALL
  USING (is_superadmin() AND clinic_id IS NULL);

CREATE POLICY pami_planilla_templates_global_manage ON pami_planilla_templates FOR ALL
  USING (is_superadmin() AND clinic_id IS NULL);

-- ---------------------------------------------------------------------------
-- RPC: active catalog for UI (maps to renderPamiPlanilla contract)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pami_planilla_catalog(p_clinic_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_categories JSONB;
  v_templates JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.slug,
      'label', c.label,
      'description', COALESCE(c.description, '')
    )
    ORDER BY c.sort_order, c.label
  ), '[]'::jsonb)
  INTO v_categories
  FROM pami_planilla_categories c
  WHERE c.clinic_id IS NULL
    AND c.is_active = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.slug,
      'category', c.slug,
      'title', t.title,
      'template', v.body_template,
      'fields', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'key', f.field_key,
            'label', f.label,
            'multiline', f.multiline,
            'placeholder', f.placeholder
          )
          ORDER BY f.sort_order, f.field_key
        ), '[]'::jsonb)
        FROM pami_planilla_template_fields f
        WHERE f.version_id = v.id
      )
    )
    ORDER BY c.sort_order, t.sort_order, t.title
  ), '[]'::jsonb)
  INTO v_templates
  FROM pami_planilla_templates t
  JOIN pami_planilla_categories c ON c.id = t.category_id
  JOIN pami_planilla_template_versions v ON v.id = t.current_version_id
  LEFT JOIN pami_planilla_clinic_template_settings s
    ON s.template_id = t.id AND s.clinic_id = p_clinic_id
  WHERE t.clinic_id IS NULL
    AND t.is_active = true
    AND c.is_active = true
    AND COALESCE(s.is_active, true) = true;

  RETURN jsonb_build_object(
    'categories', v_categories,
    'templates', v_templates
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pami_planilla_catalog(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_pami_planilla_catalog(UUID) IS
  'Returns active PAMI planilla categories and templates for renderPamiPlanilla().';

-- ---------------------------------------------------------------------------
-- RPC: publish a new template version (no deploy required)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_pami_planilla_version(
  p_template_slug TEXT,
  p_body_template TEXT,
  p_fields JSONB DEFAULT '[]'::jsonb,
  p_change_notes TEXT DEFAULT NULL,
  p_clinic_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_template_id UUID;
  v_version_number INTEGER;
  v_version_id UUID;
  v_field JSONB;
  v_sort INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM raise_app_error('NOT_AUTHENTICATED');
  END IF;

  IF p_clinic_id IS NULL AND NOT is_superadmin() THEN
    PERFORM raise_app_error('FORBIDDEN');
  END IF;

  IF p_clinic_id IS NOT NULL AND NOT can_manage_clinic(p_clinic_id) AND NOT is_superadmin() THEN
    PERFORM raise_app_error('FORBIDDEN');
  END IF;

  SELECT t.id INTO v_template_id
  FROM pami_planilla_templates t
  WHERE t.slug = p_template_slug
    AND (
      (p_clinic_id IS NULL AND t.clinic_id IS NULL)
      OR t.clinic_id = p_clinic_id
    );

  IF v_template_id IS NULL THEN
    PERFORM raise_app_error('TEMPLATE_NOT_FOUND');
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_version_number
  FROM pami_planilla_template_versions
  WHERE template_id = v_template_id;

  INSERT INTO pami_planilla_template_versions (
    template_id, version_number, body_template, change_notes, created_by
  )
  VALUES (v_template_id, v_version_number, p_body_template, p_change_notes, v_user_id)
  RETURNING id INTO v_version_id;

  FOR v_field IN SELECT * FROM jsonb_array_elements(COALESCE(p_fields, '[]'::jsonb))
  LOOP
    v_sort := v_sort + 1;
    INSERT INTO pami_planilla_template_fields (
      version_id, field_key, label, multiline, placeholder, is_required, sort_order
    )
    VALUES (
      v_version_id,
      v_field->>'key',
      v_field->>'label',
      COALESCE((v_field->>'multiline')::boolean, false),
      NULLIF(v_field->>'placeholder', ''),
      COALESCE((v_field->>'is_required')::boolean, false),
      COALESCE((v_field->>'sort_order')::integer, v_sort)
    );
  END LOOP;

  UPDATE pami_planilla_templates
  SET current_version_id = v_version_id, updated_at = now()
  WHERE id = v_template_id;

  RETURN jsonb_build_object(
    'template_id', v_template_id,
    'version_id', v_version_id,
    'version_number', v_version_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_pami_planilla_version(TEXT, TEXT, JSONB, TEXT, UUID)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Helper: idempotent upsert of one global template + v1
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._upsert_global_pami_planilla_template(
  p_category_slug TEXT,
  p_template_slug TEXT,
  p_title TEXT,
  p_sort_order INTEGER,
  p_body TEXT,
  p_fields JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id UUID;
  v_template_id UUID;
  v_version_id UUID;
  v_field JSONB;
  v_sort INTEGER := 0;
BEGIN
  SELECT id INTO v_category_id
  FROM pami_planilla_categories
  WHERE slug = p_category_slug AND clinic_id IS NULL;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Category % not seeded', p_category_slug;
  END IF;

  INSERT INTO pami_planilla_templates (slug, category_id, clinic_id, title, sort_order)
  VALUES (p_template_slug, v_category_id, NULL, p_title, p_sort_order)
  ON CONFLICT (slug) WHERE clinic_id IS NULL DO UPDATE
    SET title = EXCLUDED.title,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
  RETURNING id INTO v_template_id;

  IF v_template_id IS NULL THEN
    SELECT id INTO v_template_id
    FROM pami_planilla_templates
    WHERE slug = p_template_slug AND clinic_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pami_planilla_templates t
    WHERE t.id = v_template_id AND t.current_version_id IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO pami_planilla_template_versions (template_id, version_number, body_template, change_notes)
  VALUES (v_template_id, 1, p_body, 'Seed inicial')
  RETURNING id INTO v_version_id;

  FOR v_field IN SELECT * FROM jsonb_array_elements(p_fields)
  LOOP
    v_sort := v_sort + 1;
    INSERT INTO pami_planilla_template_fields (
      version_id, field_key, label, multiline, placeholder, sort_order
    )
    VALUES (
      v_version_id,
      v_field->>'key',
      v_field->>'label',
      COALESCE((v_field->>'multiline')::boolean, false),
      NULLIF(v_field->>'placeholder', ''),
      COALESCE((v_field->>'sort_order')::integer, v_sort)
    );
  END LOOP;

  UPDATE pami_planilla_templates
  SET current_version_id = v_version_id, updated_at = now()
  WHERE id = v_template_id;
END;
$$;
