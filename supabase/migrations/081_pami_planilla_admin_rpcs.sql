-- Admin RPCs for PAMI planilla catalog management from /configuracion.

-- Allow clinic admins to publish global templates (auth via p_clinic_id).
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

  IF p_clinic_id IS NULL THEN
    IF NOT is_superadmin() THEN
      PERFORM raise_app_error('FORBIDDEN');
    END IF;
  ELSIF NOT can_manage_clinic(p_clinic_id) AND NOT is_superadmin() THEN
    PERFORM raise_app_error('FORBIDDEN');
  END IF;

  SELECT t.id INTO v_template_id
  FROM pami_planilla_templates t
  WHERE t.slug = p_template_slug
    AND (
      t.clinic_id = p_clinic_id
      OR (p_clinic_id IS NOT NULL AND t.clinic_id IS NULL)
      OR (p_clinic_id IS NULL AND t.clinic_id IS NULL)
    )
  ORDER BY (t.clinic_id IS NULL) ASC
  LIMIT 1;

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

CREATE OR REPLACE FUNCTION public.set_pami_planilla_clinic_template_active(
  p_clinic_id UUID,
  p_template_slug TEXT,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM raise_app_error('NOT_AUTHENTICATED');
  END IF;

  IF NOT can_manage_clinic(p_clinic_id) AND NOT is_superadmin() THEN
    PERFORM raise_app_error('FORBIDDEN');
  END IF;

  SELECT t.id INTO v_template_id
  FROM pami_planilla_templates t
  WHERE t.slug = p_template_slug AND t.clinic_id IS NULL;

  IF v_template_id IS NULL THEN
    PERFORM raise_app_error('TEMPLATE_NOT_FOUND');
  END IF;

  IF p_is_active THEN
    DELETE FROM pami_planilla_clinic_template_settings
    WHERE clinic_id = p_clinic_id AND template_id = v_template_id;
  ELSE
    INSERT INTO pami_planilla_clinic_template_settings (clinic_id, template_id, is_active, updated_at)
    VALUES (p_clinic_id, v_template_id, false, now())
    ON CONFLICT (clinic_id, template_id) DO UPDATE
      SET is_active = false, updated_at = now();
  END IF;

  RETURN jsonb_build_object('template_slug', p_template_slug, 'is_active', p_is_active);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_pami_planilla_clinic_template_active(UUID, TEXT, BOOLEAN)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pami_planilla_admin_catalog(p_clinic_id UUID)
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
  IF auth.uid() IS NULL THEN
    PERFORM raise_app_error('NOT_AUTHENTICATED');
  END IF;

  IF p_clinic_id IS NOT NULL
    AND NOT can_manage_clinic(p_clinic_id)
    AND NOT is_superadmin() THEN
    PERFORM raise_app_error('FORBIDDEN');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.slug,
      'label', c.label,
      'description', COALESCE(c.description, ''),
      'is_active', c.is_active,
      'sort_order', c.sort_order
    )
    ORDER BY c.sort_order, c.label
  ), '[]'::jsonb)
  INTO v_categories
  FROM pami_planilla_categories c
  WHERE c.clinic_id IS NULL;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.slug,
      'category', c.slug,
      'title', t.title,
      'template', v.body_template,
      'is_active_global', t.is_active,
      'is_active_clinic', COALESCE(s.is_active, true),
      'version_number', v.version_number,
      'updated_at', t.updated_at,
      'fields', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'key', f.field_key,
            'label', f.label,
            'multiline', f.multiline,
            'placeholder', f.placeholder,
            'is_required', f.is_required,
            'sort_order', f.sort_order
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
  WHERE t.clinic_id IS NULL;

  RETURN jsonb_build_object(
    'categories', v_categories,
    'templates', v_templates
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pami_planilla_admin_catalog(UUID) TO authenticated;
