-- Feature customizations: per-clinic and per-user feature settings (Superadmin-only writes).
-- Additive and backward compatible. Staging-first. Rollback: rollback/20260928120000_feature_customizations.down.sql
--
-- Precedence (resolved in app code, src/core/customizations):
--   USER setting (clinic_id + user_id) -> CLINIC setting (clinic_id) -> GLOBAL default (feature_definitions)
--
-- Customizations are an ADDITIONAL restriction layer: they never grant plan/product/RBAC access.
-- No rows are seeded into clinic/user settings, so every clinic keeps its current behavior.
-- Depends on: clinics, profiles, clinic_members (UNIQUE clinic_id, user_id), audit_logs,
--             is_superadmin(), user_clinic_ids(), user_role_in_clinic(), assert_entitlement_superadmin().

-- ---------------------------------------------------------------------------
-- feature_definitions (global catalog; mirrors FEATURE_CUSTOMIZATION_REGISTRY in code)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_definitions (
  feature_key TEXT PRIMARY KEY CHECK (feature_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  default_enabled BOOLEAN NOT NULL DEFAULT true,
  default_config JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(default_config) = 'object'),
  configurable_by_clinic BOOLEAN NOT NULL DEFAULT true,
  configurable_by_user BOOLEAN NOT NULL DEFAULT false,
  critical BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feature_definitions IS
  'Catálogo global de funcionalidades personalizables. Defaults = comportamiento actual de la app.';

INSERT INTO public.feature_definitions
  (feature_key, display_name, description, category, default_enabled, configurable_by_clinic, configurable_by_user, critical)
VALUES
  ('clinic_module', 'Módulo Clínica', 'Módulo clínico principal (sigue sujeto a product.clinic).', 'modules', true, true, false, true),
  ('geriatrics_module', 'Módulo Geriatría', 'Geriatría (sigue sujeto a product.geriatrics).', 'modules', true, true, false, true),
  ('home_hospitalization_module', 'Internación domiciliaria', 'Módulo aún no disponible.', 'modules', false, true, false, true),
  ('waiting_room', 'Sala de espera', 'Tablero de sala de espera y cambios de estado.', 'operations', true, true, true, false),
  ('advanced_agenda', 'Agenda avanzada', 'Funciones avanzadas de agenda.', 'operations', true, true, true, false),
  ('unlimited_patients', 'Pacientes ilimitados', 'Nunca otorga ilimitados: el límite Premium/plan sigue vigente.', 'billing', true, true, false, true),
  ('advanced_reports', 'Reportes avanzados', 'Reportes y estadísticas avanzadas.', 'analytics', true, true, true, false),
  ('professional_management', 'Gestión de profesionales', 'Alta y edición de profesionales.', 'administration', true, true, false, true),
  ('professional_settlements', 'Liquidaciones a profesionales', 'Liquidaciones y honorarios.', 'administration', true, true, false, true),
  ('custom_branding', 'Marca personalizada', 'Aún no disponible.', 'appearance', false, true, false, false),
  ('custom_fields', 'Campos personalizados', 'Aún no disponible.', 'data', false, true, false, false),
  ('ai_assistant', 'Asistente IA', 'Asistente de IA (sigue sujeto a plan/entitlements).', 'ai', true, true, true, false)
ON CONFLICT (feature_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- clinic_feature_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_feature_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES public.feature_definitions(feature_key) ON DELETE CASCADE,
  enabled BOOLEAN,
  config JSONB CHECK (
    config IS NULL
    OR (jsonb_typeof(config) = 'object' AND octet_length(config::text) <= 8192)
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT clinic_feature_settings_unique UNIQUE (clinic_id, feature_key),
  CONSTRAINT clinic_feature_settings_not_empty CHECK (enabled IS NOT NULL OR config IS NOT NULL)
);

COMMENT ON TABLE public.clinic_feature_settings IS
  'Override por clínica de feature_definitions. Solo Superadmin muta (RPC). NULL = hereda default.';

CREATE INDEX IF NOT EXISTS idx_clinic_feature_settings_clinic
  ON public.clinic_feature_settings (clinic_id);

-- ---------------------------------------------------------------------------
-- user_feature_settings (user must be a member of clinic_id: composite FK)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_feature_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES public.feature_definitions(feature_key) ON DELETE CASCADE,
  enabled BOOLEAN,
  config JSONB CHECK (
    config IS NULL
    OR (jsonb_typeof(config) = 'object' AND octet_length(config::text) <= 8192)
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT user_feature_settings_unique UNIQUE (clinic_id, user_id, feature_key),
  CONSTRAINT user_feature_settings_not_empty CHECK (enabled IS NOT NULL OR config IS NOT NULL),
  CONSTRAINT user_feature_settings_member_fk FOREIGN KEY (clinic_id, user_id)
    REFERENCES public.clinic_members (clinic_id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.user_feature_settings IS
  'Override por usuario dentro de una clínica. El usuario debe ser miembro de esa clínica (FK compuesta).';

CREATE INDEX IF NOT EXISTS idx_user_feature_settings_clinic_user
  ON public.user_feature_settings (clinic_id, user_id);

-- ---------------------------------------------------------------------------
-- RLS: read-only for app roles; all writes via audited SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_feature_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feature_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_definitions_select ON public.feature_definitions;
CREATE POLICY feature_definitions_select ON public.feature_definitions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS clinic_feature_settings_select ON public.clinic_feature_settings;
CREATE POLICY clinic_feature_settings_select ON public.clinic_feature_settings
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

DROP POLICY IF EXISTS user_feature_settings_select ON public.user_feature_settings;
CREATE POLICY user_feature_settings_select ON public.user_feature_settings
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR (user_id = auth.uid() AND clinic_id IN (SELECT public.user_clinic_ids()))
    OR public.user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

-- Supabase default privileges grant ALL on new tables to authenticated; strip them (incl. TRUNCATE, which bypasses RLS).
REVOKE ALL ON public.feature_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.clinic_feature_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_feature_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.feature_definitions TO authenticated;
GRANT SELECT ON public.clinic_feature_settings TO authenticated;
GRANT SELECT ON public.user_feature_settings TO authenticated;
GRANT ALL ON public.feature_definitions TO service_role;
GRANT ALL ON public.clinic_feature_settings TO service_role;
GRANT ALL ON public.user_feature_settings TO service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_feature_environment(p_environment TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(COALESCE(p_environment, '')) IN ('production', 'staging', 'preview', 'development')
      THEN lower(p_environment)
    ELSE 'unknown'
  END;
$$;

CREATE OR REPLACE FUNCTION public.assert_feature_config_shape(p_config JSONB)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_config IS NULL THEN
    RETURN;
  END IF;
  IF jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_CONFIG';
  END IF;
  IF octet_length(p_config::text) > 8192 THEN
    RAISE EXCEPTION 'CONFIG_TOO_LARGE';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Read: one call per request -> definitions + clinic rows + caller's user rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_feature_settings_snapshot(p_clinic_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_superadmin()
     AND NOT (p_clinic_id IN (SELECT public.user_clinic_ids())) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', p_clinic_id,
    'user_id', v_uid,
    'definitions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'feature_key', d.feature_key,
        'default_enabled', d.default_enabled,
        'default_config', d.default_config,
        'is_active', d.is_active
      ))
      FROM public.feature_definitions d
    ), '[]'::jsonb),
    'clinic', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'feature_key', s.feature_key,
        'enabled', s.enabled,
        'config', s.config
      ))
      FROM public.clinic_feature_settings s
      WHERE s.clinic_id = p_clinic_id
    ), '[]'::jsonb),
    'user', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'feature_key', u.feature_key,
        'enabled', u.enabled,
        'config', u.config
      ))
      FROM public.user_feature_settings u
      JOIN public.clinic_members m
        ON m.clinic_id = u.clinic_id AND m.user_id = u.user_id AND m.is_active = true
      WHERE u.clinic_id = p_clinic_id
        AND v_uid IS NOT NULL
        AND u.user_id = v_uid
    ), '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Superadmin setters (audited, no PHI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_clinic_feature_setting(
  p_clinic_id UUID,
  p_feature_key TEXT,
  p_enabled BOOLEAN,
  p_config JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_def public.feature_definitions%ROWTYPE;
  v_old public.clinic_feature_settings%ROWTYPE;
  v_found BOOLEAN;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;
  IF p_enabled IS NULL AND p_config IS NULL THEN
    RAISE EXCEPTION 'EMPTY_SETTING';
  END IF;
  PERFORM public.assert_feature_config_shape(p_config);

  SELECT * INTO v_def FROM public.feature_definitions
  WHERE feature_key = p_feature_key AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_FEATURE';
  END IF;
  IF NOT v_def.configurable_by_clinic THEN
    RAISE EXCEPTION 'NOT_CONFIGURABLE_BY_CLINIC';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  SELECT * INTO v_old FROM public.clinic_feature_settings
  WHERE clinic_id = p_clinic_id AND feature_key = p_feature_key
  FOR UPDATE;
  v_found := FOUND;

  IF v_found THEN
    UPDATE public.clinic_feature_settings
    SET enabled = p_enabled, config = p_config, updated_at = now(), updated_by = v_actor
    WHERE id = v_old.id;
  ELSE
    INSERT INTO public.clinic_feature_settings
      (clinic_id, feature_key, enabled, config, created_by, updated_by)
    VALUES (p_clinic_id, p_feature_key, p_enabled, p_config, v_actor, v_actor);
  END IF;

  INSERT INTO public.audit_logs (
    clinic_id, user_id, entity_type, entity_id, action, module, what,
    old_values, new_values, metadata
  ) VALUES (
    p_clinic_id,
    v_actor,
    'clinic_feature_setting',
    p_clinic_id,
    CASE WHEN v_found THEN 'update' ELSE 'create' END::audit_action,
    'settings',
    format('Personalización %s (clínica)', p_feature_key),
    CASE WHEN v_found
      THEN jsonb_build_object('enabled', v_old.enabled, 'config', v_old.config)
      ELSE NULL END,
    jsonb_build_object('enabled', p_enabled, 'config', p_config),
    jsonb_build_object(
      'feature_key', p_feature_key,
      'scope', 'clinic',
      'target_user_id', NULL,
      'environment', public.normalize_feature_environment(p_environment),
      'reason', left(NULLIF(trim(COALESCE(p_reason, '')), ''), 500),
      'source', 'superadmin_customizations'
    )
  );

  RETURN jsonb_build_object('ok', true, 'clinic_id', p_clinic_id, 'feature_key', p_feature_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_clinic_feature_setting(
  p_clinic_id UUID,
  p_feature_key TEXT,
  p_reason TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_old public.clinic_feature_settings%ROWTYPE;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.feature_definitions WHERE feature_key = p_feature_key) THEN
    RAISE EXCEPTION 'UNKNOWN_FEATURE';
  END IF;

  DELETE FROM public.clinic_feature_settings
  WHERE clinic_id = p_clinic_id AND feature_key = p_feature_key
  RETURNING * INTO v_old;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'cleared', false);
  END IF;

  INSERT INTO public.audit_logs (
    clinic_id, user_id, entity_type, entity_id, action, module, what,
    old_values, new_values, metadata
  ) VALUES (
    p_clinic_id,
    v_actor,
    'clinic_feature_setting',
    p_clinic_id,
    'delete'::audit_action,
    'settings',
    format('Personalización %s restablecida (clínica)', p_feature_key),
    jsonb_build_object('enabled', v_old.enabled, 'config', v_old.config),
    NULL,
    jsonb_build_object(
      'feature_key', p_feature_key,
      'scope', 'clinic',
      'target_user_id', NULL,
      'environment', public.normalize_feature_environment(p_environment),
      'reason', left(NULLIF(trim(COALESCE(p_reason, '')), ''), 500),
      'source', 'superadmin_customizations'
    )
  );

  RETURN jsonb_build_object('ok', true, 'cleared', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_feature_setting(
  p_clinic_id UUID,
  p_user_id UUID,
  p_feature_key TEXT,
  p_enabled BOOLEAN,
  p_config JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_def public.feature_definitions%ROWTYPE;
  v_old public.user_feature_settings%ROWTYPE;
  v_found BOOLEAN;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_clinic_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_AND_USER_REQUIRED';
  END IF;
  IF p_enabled IS NULL AND p_config IS NULL THEN
    RAISE EXCEPTION 'EMPTY_SETTING';
  END IF;
  PERFORM public.assert_feature_config_shape(p_config);

  SELECT * INTO v_def FROM public.feature_definitions
  WHERE feature_key = p_feature_key AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_FEATURE';
  END IF;
  IF NOT v_def.configurable_by_user THEN
    RAISE EXCEPTION 'NOT_CONFIGURABLE_BY_USER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = p_clinic_id AND user_id = p_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'USER_NOT_IN_CLINIC';
  END IF;

  SELECT * INTO v_old FROM public.user_feature_settings
  WHERE clinic_id = p_clinic_id AND user_id = p_user_id AND feature_key = p_feature_key
  FOR UPDATE;
  v_found := FOUND;

  IF v_found THEN
    UPDATE public.user_feature_settings
    SET enabled = p_enabled, config = p_config, updated_at = now(), updated_by = v_actor
    WHERE id = v_old.id;
  ELSE
    INSERT INTO public.user_feature_settings
      (clinic_id, user_id, feature_key, enabled, config, created_by, updated_by)
    VALUES (p_clinic_id, p_user_id, p_feature_key, p_enabled, p_config, v_actor, v_actor);
  END IF;

  INSERT INTO public.audit_logs (
    clinic_id, user_id, entity_type, entity_id, action, module, what,
    old_values, new_values, metadata
  ) VALUES (
    p_clinic_id,
    v_actor,
    'user_feature_setting',
    p_user_id,
    CASE WHEN v_found THEN 'update' ELSE 'create' END::audit_action,
    'settings',
    format('Personalización %s (usuario)', p_feature_key),
    CASE WHEN v_found
      THEN jsonb_build_object('enabled', v_old.enabled, 'config', v_old.config)
      ELSE NULL END,
    jsonb_build_object('enabled', p_enabled, 'config', p_config),
    jsonb_build_object(
      'feature_key', p_feature_key,
      'scope', 'user',
      'target_user_id', p_user_id,
      'environment', public.normalize_feature_environment(p_environment),
      'reason', left(NULLIF(trim(COALESCE(p_reason, '')), ''), 500),
      'source', 'superadmin_customizations'
    )
  );

  RETURN jsonb_build_object(
    'ok', true, 'clinic_id', p_clinic_id, 'user_id', p_user_id, 'feature_key', p_feature_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_user_feature_setting(
  p_clinic_id UUID,
  p_user_id UUID,
  p_feature_key TEXT,
  p_reason TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_old public.user_feature_settings%ROWTYPE;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_clinic_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_AND_USER_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.feature_definitions WHERE feature_key = p_feature_key) THEN
    RAISE EXCEPTION 'UNKNOWN_FEATURE';
  END IF;

  DELETE FROM public.user_feature_settings
  WHERE clinic_id = p_clinic_id AND user_id = p_user_id AND feature_key = p_feature_key
  RETURNING * INTO v_old;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'cleared', false);
  END IF;

  INSERT INTO public.audit_logs (
    clinic_id, user_id, entity_type, entity_id, action, module, what,
    old_values, new_values, metadata
  ) VALUES (
    p_clinic_id,
    v_actor,
    'user_feature_setting',
    p_user_id,
    'delete'::audit_action,
    'settings',
    format('Personalización %s restablecida (usuario)', p_feature_key),
    jsonb_build_object('enabled', v_old.enabled, 'config', v_old.config),
    NULL,
    jsonb_build_object(
      'feature_key', p_feature_key,
      'scope', 'user',
      'target_user_id', p_user_id,
      'environment', public.normalize_feature_environment(p_environment),
      'reason', left(NULLIF(trim(COALESCE(p_reason, '')), ''), 500),
      'source', 'superadmin_customizations'
    )
  );

  RETURN jsonb_build_object('ok', true, 'cleared', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants: never anon / PUBLIC
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_feature_settings_snapshot(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_clinic_feature_setting(UUID, TEXT, BOOLEAN, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_clinic_feature_setting(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_user_feature_setting(UUID, UUID, TEXT, BOOLEAN, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_user_feature_setting(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_feature_settings_snapshot(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_clinic_feature_setting(UUID, TEXT, BOOLEAN, JSONB, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_clinic_feature_setting(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_feature_setting(UUID, UUID, TEXT, BOOLEAN, JSONB, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_user_feature_setting(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
