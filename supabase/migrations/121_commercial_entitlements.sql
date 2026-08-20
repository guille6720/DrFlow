-- Phase 1: commercial entitlement infrastructure (plans, features, limits).
-- Additive only. Does not replace clinic_subscriptions (Mercado Pago billing),
-- clinic_feature_flags (UX flags), or RBAC helpers (user_role_in_clinic, etc.).
-- Tenant = clinics. Existing clinics are backfilled to internal plan "legacy".
-- New clinics receive public plan "trial" (status trialing, trial_ends_at NULL).
-- Do NOT apply to production from this workstream.

-- ---------------------------------------------------------------------------
-- Catalog: plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plans_key_nonempty CHECK (trim(key) <> '')
);

COMMENT ON TABLE public.plans IS
  'Catálogo comercial de planes SaaS. No confundir con clinic_subscriptions.plan_id (Mercado Pago).';

-- ---------------------------------------------------------------------------
-- Catalog: features
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('boolean', 'limit')),
  default_value JSONB,
  usage_metered BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT features_key_nonempty CHECK (trim(key) <> '')
);

COMMENT ON TABLE public.features IS
  'Registro de funcionalidades comerciales (boolean / limit). Distinto de clinic_feature_flags.';

-- ---------------------------------------------------------------------------
-- Plan × feature matrix
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_features (
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, feature_id)
);

COMMENT ON TABLE public.plan_features IS
  'Matriz editable plan × feature. value JSONB: número de límite o null (ilimitado).';

-- ---------------------------------------------------------------------------
-- Clinic commercial subscription (organization_subscriptions)
-- Separate from Mercado Pago clinic_subscriptions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_entitlement_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL CHECK (
    status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')
  ),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clinic_entitlement_subscriptions IS
  'Suscripción comercial del consultorio (entitlements). No reemplaza clinic_subscriptions de Mercado Pago.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_entitlement_subs_one_live
  ON public.clinic_entitlement_subscriptions (clinic_id)
  WHERE status IN ('trialing', 'active');

CREATE INDEX IF NOT EXISTS idx_clinic_entitlement_subs_clinic
  ON public.clinic_entitlement_subscriptions (clinic_id, status);

CREATE INDEX IF NOT EXISTS idx_clinic_entitlement_subs_plan
  ON public.clinic_entitlement_subscriptions (plan_id);

-- ---------------------------------------------------------------------------
-- Organization feature overrides
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  value JSONB,
  reason TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clinic_feature_overrides IS
  'Overrides comerciales por consultorio (prioridad sobre el plan). Add-on ready.';

CREATE INDEX IF NOT EXISTS idx_clinic_feature_overrides_clinic_feature
  ON public.clinic_feature_overrides (clinic_id, feature_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_feature_overrides_clinic_live
  ON public.clinic_feature_overrides (clinic_id, feature_id)
  WHERE starts_at IS NULL OR ends_at IS NULL;

-- ---------------------------------------------------------------------------
-- Metered usage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feature_usage_clinic_feature_period_uidx
    UNIQUE (clinic_id, feature_id, period_start)
);

COMMENT ON TABLE public.feature_usage IS
  'Consumo mensual atómico por consultorio × feature metered (IA, WhatsApp, etc.).';

CREATE INDEX IF NOT EXISTS idx_feature_usage_clinic_period
  ON public.feature_usage (clinic_id, period_start);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_entitlement_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_select ON public.plans;
CREATE POLICY plans_select ON public.plans
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS features_select ON public.features;
CREATE POLICY features_select ON public.features
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS plan_features_select ON public.plan_features;
CREATE POLICY plan_features_select ON public.plan_features
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS clinic_entitlement_subscriptions_select
  ON public.clinic_entitlement_subscriptions;
CREATE POLICY clinic_entitlement_subscriptions_select
  ON public.clinic_entitlement_subscriptions
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR clinic_id IN (SELECT user_clinic_ids())
  );

DROP POLICY IF EXISTS clinic_feature_overrides_select ON public.clinic_feature_overrides;
CREATE POLICY clinic_feature_overrides_select ON public.clinic_feature_overrides
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR clinic_id IN (SELECT user_clinic_ids())
  );

DROP POLICY IF EXISTS feature_usage_select ON public.feature_usage;
CREATE POLICY feature_usage_select ON public.feature_usage
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR clinic_id IN (SELECT user_clinic_ids())
  );

-- No INSERT/UPDATE/DELETE policies for authenticated: catalog, subscriptions,
-- overrides and usage are mutated only via SECURITY DEFINER RPCs, triggers, or service_role.

REVOKE ALL ON TABLE public.plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.features FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.plan_features FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.clinic_entitlement_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.clinic_feature_overrides FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.feature_usage FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.plans TO authenticated;
GRANT SELECT ON TABLE public.features TO authenticated;
GRANT SELECT ON TABLE public.plan_features TO authenticated;
GRANT SELECT ON TABLE public.clinic_entitlement_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.clinic_feature_overrides TO authenticated;
GRANT SELECT ON TABLE public.feature_usage TO authenticated;

GRANT ALL ON TABLE public.plans TO service_role;
GRANT ALL ON TABLE public.features TO service_role;
GRANT ALL ON TABLE public.plan_features TO service_role;
GRANT ALL ON TABLE public.clinic_entitlement_subscriptions TO service_role;
GRANT ALL ON TABLE public.clinic_feature_overrides TO service_role;
GRANT ALL ON TABLE public.feature_usage TO service_role;

-- ---------------------------------------------------------------------------
-- Seed: plans
-- ---------------------------------------------------------------------------
INSERT INTO public.plans (key, name, description, is_active, is_internal, is_public, display_order, metadata)
VALUES
  (
    'trial',
    'Prueba',
    'Plan de onboarding para consultorios nuevos. Duración configurable (trial_ends_at NULL hasta definirla).',
    true,
    false,
    true,
    0,
    '{"trial_duration_days": null, "duration_configurable": true}'::jsonb
  ),
  (
    'basic',
    'Basic',
    'Agenda, pacientes, historia clínica, consultas, órdenes y reportes básicos.',
    true,
    false,
    true,
    1,
    '{}'::jsonb
  ),
  (
    'pro',
    'Pro',
    'Basic más PAMI, coberturas, exportaciones y más usuarios/profesionales.',
    true,
    false,
    true,
    2,
    '{}'::jsonb
  ),
  (
    'premium',
    'Premium',
    'Pro más IA, WhatsApp, recordatorios, transcripción y automatizaciones.',
    true,
    false,
    true,
    3,
    '{}'::jsonb
  ),
  (
    'enterprise',
    'Enterprise',
    'Todo el producto más API, integraciones, branding y límites a medida.',
    true,
    false,
    true,
    4,
    '{}'::jsonb
  ),
  (
    'legacy',
    'Legacy (interno)',
    'Plan interno de migración. Nunca asignable en onboarding automático.',
    true,
    true,
    false,
    99,
    '{"internal": true, "migration_only": true, "assignable_only_by_superadmin": true}'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  is_internal = EXCLUDED.is_internal,
  is_public = EXCLUDED.is_public,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Seed: features (aligned to modules reales de DrFlow)
-- ---------------------------------------------------------------------------
INSERT INTO public.features (key, name, description, feature_type, default_value, usage_metered, is_active, metadata)
VALUES
  ('core.dashboard', 'Dashboard', 'Centro de operaciones del consultorio', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('patients.enabled', 'Pacientes', 'Ficha y workspace de pacientes', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('appointments.enabled', 'Agenda', 'Turnos y calendario', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('waiting_room.enabled', 'Sala de espera', 'Cola de sala de espera', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('clinical_history.enabled', 'Historia clínica', 'HC y evoluciones', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('consultations.enabled', 'Consultas', 'Atenciones / consultas', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('medical_orders.enabled', 'Órdenes y recetas', 'Recetas y órdenes médicas', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('templates.enabled', 'Plantillas', 'Plantillas clínicas y de recetas', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('documents.enabled', 'Documentos', 'Documentos administrativos y clínicos', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('pdf_export.enabled', 'Exportación PDF', 'Exportar documentos en PDF', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('data_export.enabled', 'Exportación de datos', 'Exportación masiva / FHIR / CSV', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('pami.enabled', 'PAMI', 'Guía cabecera, planillas y vademécum PAMI', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('insurance.enabled', 'Obras sociales', 'Coberturas, liquidación y reglas', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('reports.basic', 'Reportes básicos', 'Informes operativos', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('reports.advanced', 'Reportes avanzados', 'BI y reportes avanzados', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('audit.enabled', 'Auditoría', 'Trazabilidad inmutable', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('whatsapp.enabled', 'WhatsApp', 'Canal WhatsApp', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('whatsapp.reminders', 'Recordatorios WhatsApp', 'Recordatorios de turno por WhatsApp', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('notifications.enabled', 'Notificaciones', 'Notificaciones del consultorio', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('automation.enabled', 'Automatizaciones', 'Automatizaciones operativas', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('automation.follow_up', 'Seguimiento automático', 'Follow-up automático de pacientes', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('ai.enabled', 'IA clínica', 'Asistente de IA', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('ai.clinical_summary', 'Resumen clínico IA', 'Resúmenes clínicos generados por IA', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('ai.document_generation', 'Documentos IA', 'Generación de documentos con IA', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('ai.transcription', 'Transcripción IA', 'Transcripción de consultas', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('integrations.enabled', 'Integraciones', 'Importación / interoperabilidad', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('api.enabled', 'API pública', 'API v1 del consultorio', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('branding.custom', 'Branding', 'Logo y personalización visual', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('telemedicine.enabled', 'Telemedicina', 'Videoconsulta', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('pharmacology.enabled', 'Farmacología', 'Guía farmacológica', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('portal.enabled', 'Portal paciente', 'PWA y reserva pública', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('voice.enabled', 'Dictado por voz', 'Entrada de voz en campos clínicos', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('cash_register.enabled', 'Caja', 'Cobranzas y cierre de caja', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('professionals.enabled', 'Profesionales', 'Equipo y firmas', 'boolean', 'false'::jsonb, false, true, '{}'::jsonb),
  ('users.max', 'Máximo de usuarios', 'Límite de miembros del consultorio', 'limit', '0'::jsonb, false, true, '{}'::jsonb),
  ('professionals.max', 'Máximo de profesionales', 'Límite de profesionales', 'limit', '0'::jsonb, false, true, '{}'::jsonb),
  ('patients.max', 'Máximo de pacientes', 'Límite de pacientes', 'limit', '0'::jsonb, false, true, '{}'::jsonb),
  ('ai.monthly_requests', 'IA: requests mensuales', 'Cuota mensual de requests de IA', 'limit', '0'::jsonb, true, true, '{}'::jsonb),
  ('ai.monthly_transcriptions', 'IA: transcripciones mensuales', 'Cuota mensual de transcripciones', 'limit', '0'::jsonb, true, true, '{}'::jsonb),
  ('whatsapp.monthly_messages', 'WhatsApp: mensajes mensuales', 'Cuota mensual de mensajes WhatsApp', 'limit', '0'::jsonb, true, true, '{}'::jsonb),
  ('automations.max_active', 'Automatizaciones activas', 'Máximo de automatizaciones activas', 'limit', '0'::jsonb, false, true, '{}'::jsonb),
  ('storage.max_mb', 'Almacenamiento (MB)', 'Cuota de storage en megabytes', 'limit', '0'::jsonb, true, true, '{}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  feature_type = EXCLUDED.feature_type,
  default_value = EXCLUDED.default_value,
  usage_metered = EXCLUDED.usage_metered,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Seed: plan_features matrix
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_basic_bool TEXT[] := ARRAY[
    'core.dashboard',
    'patients.enabled',
    'appointments.enabled',
    'waiting_room.enabled',
    'clinical_history.enabled',
    'consultations.enabled',
    'medical_orders.enabled',
    'templates.enabled',
    'documents.enabled',
    'reports.basic',
    'audit.enabled',
    'notifications.enabled',
    'professionals.enabled'
  ];
  v_pro_extra TEXT[] := ARRAY[
    'pami.enabled',
    'insurance.enabled',
    'pdf_export.enabled',
    'data_export.enabled',
    'cash_register.enabled',
    'pharmacology.enabled',
    'portal.enabled',
    'telemedicine.enabled'
  ];
  v_premium_extra TEXT[] := ARRAY[
    'reports.advanced',
    'whatsapp.enabled',
    'whatsapp.reminders',
    'automation.enabled',
    'automation.follow_up',
    'ai.enabled',
    'ai.clinical_summary',
    'ai.document_generation',
    'ai.transcription',
    'voice.enabled'
  ];
  v_enterprise_extra TEXT[] := ARRAY[
    'integrations.enabled',
    'api.enabled',
    'branding.custom'
  ];
BEGIN
  -- Full access: trial (evaluation), legacy (preserve existing), enterprise
  INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
  SELECT p.id, f.id, true,
    CASE WHEN f.feature_type = 'limit' THEN NULL::jsonb ELSE NULL::jsonb END
  FROM public.plans p
  CROSS JOIN public.features f
  WHERE p.key IN ('trial', 'legacy', 'enterprise')
  ON CONFLICT (plan_id, feature_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    value = EXCLUDED.value,
    updated_at = now();

  -- Basic / Pro / Premium: start disabled, then enable sets
  INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
  SELECT p.id, f.id, false,
    CASE WHEN f.feature_type = 'limit' THEN '0'::jsonb ELSE NULL::jsonb END
  FROM public.plans p
  CROSS JOIN public.features f
  WHERE p.key IN ('basic', 'pro', 'premium')
  ON CONFLICT (plan_id, feature_id) DO NOTHING;

  -- Boolean enablement
  UPDATE public.plan_features pf
  SET enabled = true, value = NULL, updated_at = now()
  FROM public.plans p, public.features f
  WHERE pf.plan_id = p.id AND pf.feature_id = f.id
    AND f.feature_type = 'boolean'
    AND (
      (p.key = 'basic' AND f.key = ANY (v_basic_bool))
      OR (p.key = 'pro' AND (f.key = ANY (v_basic_bool) OR f.key = ANY (v_pro_extra)))
      OR (
        p.key = 'premium'
        AND (f.key = ANY (v_basic_bool) OR f.key = ANY (v_pro_extra) OR f.key = ANY (v_premium_extra))
      )
    );

  -- Enterprise extras already covered by full-access insert; keep array for documentation
  PERFORM 1 FROM unnest(v_enterprise_extra) AS x;
END $$;

-- Limits: basic / pro / premium
UPDATE public.plan_features pf
SET
  enabled = (v.limit_value IS NOT NULL AND v.limit_value <> 0) OR (v.limit_value IS NULL),
  value = to_jsonb(v.limit_value),
  updated_at = now()
FROM public.plans p, public.features f,
LATERAL (
  SELECT CASE
    WHEN p.key = 'basic' AND f.key = 'users.max' THEN 3
    WHEN p.key = 'basic' AND f.key = 'professionals.max' THEN 1
    WHEN p.key = 'basic' AND f.key = 'patients.max' THEN 500
    WHEN p.key = 'basic' AND f.key = 'storage.max_mb' THEN 500
    WHEN p.key = 'basic' AND f.key IN (
      'ai.monthly_requests', 'ai.monthly_transcriptions',
      'whatsapp.monthly_messages', 'automations.max_active'
    ) THEN 0
    WHEN p.key = 'pro' AND f.key = 'users.max' THEN 10
    WHEN p.key = 'pro' AND f.key = 'professionals.max' THEN 5
    WHEN p.key = 'pro' AND f.key = 'patients.max' THEN NULL
    WHEN p.key = 'pro' AND f.key = 'storage.max_mb' THEN 5000
    WHEN p.key = 'pro' AND f.key IN (
      'ai.monthly_requests', 'ai.monthly_transcriptions',
      'whatsapp.monthly_messages', 'automations.max_active'
    ) THEN 0
    WHEN p.key = 'premium' AND f.key = 'users.max' THEN 25
    WHEN p.key = 'premium' AND f.key = 'professionals.max' THEN 15
    WHEN p.key = 'premium' AND f.key = 'patients.max' THEN NULL
    WHEN p.key = 'premium' AND f.key = 'ai.monthly_requests' THEN 500
    WHEN p.key = 'premium' AND f.key = 'ai.monthly_transcriptions' THEN 100
    WHEN p.key = 'premium' AND f.key = 'whatsapp.monthly_messages' THEN 2000
    WHEN p.key = 'premium' AND f.key = 'automations.max_active' THEN 20
    WHEN p.key = 'premium' AND f.key = 'storage.max_mb' THEN 20000
    ELSE -1
  END AS limit_value
) v
WHERE pf.plan_id = p.id
  AND pf.feature_id = f.id
  AND p.key IN ('basic', 'pro', 'premium')
  AND f.feature_type = 'limit'
  AND v.limit_value IS DISTINCT FROM -1;

-- Unlimited limits for trial / legacy / enterprise (value NULL)
UPDATE public.plan_features pf
SET enabled = true, value = NULL, updated_at = now()
FROM public.plans p, public.features f
WHERE pf.plan_id = p.id
  AND pf.feature_id = f.id
  AND p.key IN ('trial', 'legacy', 'enterprise')
  AND f.feature_type = 'limit';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plan_forbidden_for_automatic_assignment(p_plan public.plans)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    p_plan.is_internal
    OR NOT p_plan.is_public
    OR p_plan.key = 'legacy'
    OR COALESCE((p_plan.metadata->>'internal')::boolean, false)
    OR COALESCE((p_plan.metadata->>'migration_only')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.assert_entitlement_clinic_access(p_clinic_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT (is_superadmin() OR user_role_in_clinic(p_clinic_id) IS NOT NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.feature_usage_period_start(p_at TIMESTAMPTZ DEFAULT now())
RETURNS DATE
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT date_trunc('month', timezone('utc', p_at))::date;
$$;

CREATE OR REPLACE FUNCTION public.entitlement_limit_value(
  p_feature_type TEXT,
  p_enabled BOOLEAN,
  p_value JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_feature_type = 'boolean' THEN
    RETURN CASE WHEN COALESCE(p_enabled, false) THEN NULL ELSE 0 END;
  END IF;
  IF NOT COALESCE(p_enabled, false) THEN
    RETURN 0;
  END IF;
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN (p_value #>> '{}')::numeric;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN 0;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.entitlement_default_enabled(
  p_feature_type TEXT,
  p_default JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_feature_type = 'boolean' THEN COALESCE(p_default = 'true'::jsonb, false)
    WHEN p_default IS NULL OR p_default = 'null'::jsonb OR p_default = '0'::jsonb THEN false
    ELSE true
  END;
$$;

-- Resolve a single feature. Fail closed. Empty result = unknown / inactive = DENY.
CREATE OR REPLACE FUNCTION public.resolve_clinic_feature_entitlement(
  p_clinic_id UUID,
  p_feature_key TEXT
)
RETURNS TABLE (
  feature_key TEXT,
  feature_type TEXT,
  enabled BOOLEAN,
  limit_value NUMERIC,
  source TEXT,
  usage_metered BOOLEAN,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH catalog AS (
    SELECT f.*
    FROM public.features f
    WHERE f.key = p_feature_key
      AND f.is_active
  ),
  live_override AS (
    SELECT o.enabled, o.value
    FROM public.clinic_feature_overrides o
    JOIN catalog f ON f.id = o.feature_id
    WHERE o.clinic_id = p_clinic_id
      AND (o.starts_at IS NULL OR o.starts_at <= now())
      AND (o.ends_at IS NULL OR o.ends_at > now())
    ORDER BY o.created_at DESC
    LIMIT 1
  ),
  live_plan AS (
    SELECT pf.enabled, pf.value
    FROM public.clinic_entitlement_subscriptions s
    JOIN public.plan_features pf
      ON pf.plan_id = s.plan_id
    JOIN catalog f ON f.id = pf.feature_id
    WHERE s.clinic_id = p_clinic_id
      AND s.status IN ('trialing', 'active')
    ORDER BY s.created_at DESC
    LIMIT 1
  ),
  picked AS (
    SELECT
      f.key,
      f.feature_type,
      f.usage_metered,
      f.is_active,
      CASE
        WHEN ov.enabled IS NOT NULL THEN ov.enabled
        WHEN pf.enabled IS NOT NULL THEN pf.enabled
        ELSE public.entitlement_default_enabled(f.feature_type, f.default_value)
      END AS enabled,
      CASE
        WHEN ov.enabled IS NOT NULL THEN ov.value
        WHEN pf.enabled IS NOT NULL THEN pf.value
        ELSE f.default_value
      END AS value,
      CASE
        WHEN ov.enabled IS NOT NULL THEN 'override'
        WHEN pf.enabled IS NOT NULL THEN 'plan'
        ELSE 'default'
      END AS source
    FROM catalog f
    LEFT JOIN live_override ov ON true
    LEFT JOIN live_plan pf ON true
  )
  SELECT
    picked.key,
    picked.feature_type,
    picked.enabled,
    public.entitlement_limit_value(picked.feature_type, picked.enabled, picked.value),
    picked.source,
    picked.usage_metered,
    picked.is_active
  FROM picked;
$$;

-- One round-trip: all active catalog features resolved for the clinic (no app N+1).
CREATE OR REPLACE FUNCTION public.get_clinic_entitlements(p_clinic_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_key TEXT;
  v_plan_id UUID;
  v_status TEXT;
  v_trial_ends_at TIMESTAMPTZ;
  v_features JSONB;
BEGIN
  PERFORM public.assert_entitlement_clinic_access(p_clinic_id);

  SELECT p.key, s.plan_id, s.status, s.trial_ends_at
    INTO v_plan_key, v_plan_id, v_status, v_trial_ends_at
  FROM public.clinic_entitlement_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.clinic_id = p_clinic_id
    AND s.status IN ('trialing', 'active')
  ORDER BY s.created_at DESC
  LIMIT 1;

  SELECT COALESCE(jsonb_object_agg(q.key, q.body), '{}'::jsonb)
    INTO v_features
  FROM (
    WITH live_sub AS (
      SELECT s.plan_id
      FROM public.clinic_entitlement_subscriptions s
      WHERE s.clinic_id = p_clinic_id
        AND s.status IN ('trialing', 'active')
      ORDER BY s.created_at DESC
      LIMIT 1
    ),
    live_overrides AS (
      SELECT DISTINCT ON (o.feature_id)
        o.feature_id,
        o.enabled,
        o.value
      FROM public.clinic_feature_overrides o
      WHERE o.clinic_id = p_clinic_id
        AND (o.starts_at IS NULL OR o.starts_at <= now())
        AND (o.ends_at IS NULL OR o.ends_at > now())
      ORDER BY o.feature_id, o.created_at DESC
    )
    SELECT
      f.key,
      jsonb_build_object(
        'enabled', picked.enabled,
        'limit', to_jsonb(
          public.entitlement_limit_value(f.feature_type, picked.enabled, picked.value)
        ),
        'source', picked.source,
        'feature_type', f.feature_type
      ) AS body
    FROM public.features f
    LEFT JOIN live_overrides ov ON ov.feature_id = f.id
    LEFT JOIN public.plan_features pf
      ON pf.feature_id = f.id
     AND pf.plan_id = (SELECT plan_id FROM live_sub)
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN ov.feature_id IS NOT NULL THEN ov.enabled
          WHEN pf.plan_id IS NOT NULL THEN pf.enabled
          ELSE public.entitlement_default_enabled(f.feature_type, f.default_value)
        END AS enabled,
        CASE
          WHEN ov.feature_id IS NOT NULL THEN ov.value
          WHEN pf.plan_id IS NOT NULL THEN pf.value
          ELSE f.default_value
        END AS value,
        CASE
          WHEN ov.feature_id IS NOT NULL THEN 'override'
          WHEN pf.plan_id IS NOT NULL THEN 'plan'
          ELSE 'default'
        END AS source
    ) picked
    WHERE f.is_active
  ) q;

  RETURN jsonb_build_object(
    'clinic_id', p_clinic_id,
    'plan_key', to_jsonb(v_plan_key),
    'plan_id', to_jsonb(v_plan_id),
    'status', to_jsonb(v_status),
    'trial_ends_at', to_jsonb(v_trial_ends_at),
    'features', COALESCE(v_features, '{}'::jsonb)
  );
END;
$$;

-- Atomic usage increment (no quota check).
CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  p_clinic_id UUID,
  p_feature_key TEXT,
  p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature public.features%ROWTYPE;
  v_period DATE := public.feature_usage_period_start();
  v_amount BIGINT;
BEGIN
  PERFORM public.assert_entitlement_clinic_access(p_clinic_id);

  IF p_amount IS NULL OR p_amount = 0 OR p_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  SELECT * INTO v_feature FROM public.features WHERE key = p_feature_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_FEATURE';
  END IF;
  IF v_feature.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FEATURE_INACTIVE';
  END IF;
  IF v_feature.usage_metered IS NOT TRUE THEN
    RAISE EXCEPTION 'FEATURE_NOT_METERED';
  END IF;

  INSERT INTO public.feature_usage (clinic_id, feature_id, period_start, amount)
  VALUES (p_clinic_id, v_feature.id, v_period, p_amount)
  ON CONFLICT (clinic_id, feature_id, period_start)
  DO UPDATE SET
    amount = public.feature_usage.amount + EXCLUDED.amount,
    updated_at = now()
  RETURNING amount INTO v_amount;

  RETURN jsonb_build_object(
    'ok', true,
    'amount', v_amount,
    'period_start', v_period
  );
END;
$$;

-- Atomic resolve-limit + check + consume (no check-then-increment race).
CREATE OR REPLACE FUNCTION public.try_consume_feature_usage(
  p_clinic_id UUID,
  p_feature_key TEXT,
  p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved RECORD;
  v_feature_id UUID;
  v_period DATE := public.feature_usage_period_start();
  v_amount BIGINT;
  v_limit NUMERIC;
BEGIN
  PERFORM public.assert_entitlement_clinic_access(p_clinic_id);

  IF p_amount IS NULL OR p_amount = 0 OR p_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  SELECT * INTO v_resolved
  FROM public.resolve_clinic_feature_entitlement(p_clinic_id, p_feature_key);

  IF v_resolved.feature_key IS NULL THEN
    RAISE EXCEPTION 'UNKNOWN_FEATURE';
  END IF;
  IF v_resolved.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FEATURE_INACTIVE';
  END IF;
  IF v_resolved.usage_metered IS NOT TRUE THEN
    RAISE EXCEPTION 'FEATURE_NOT_METERED';
  END IF;
  IF v_resolved.enabled IS NOT TRUE OR COALESCE(v_resolved.limit_value, 1) = 0 THEN
    RAISE EXCEPTION 'FEATURE_DISABLED';
  END IF;

  SELECT id INTO v_feature_id FROM public.features WHERE key = p_feature_key;
  v_limit := v_resolved.limit_value;

  INSERT INTO public.feature_usage (clinic_id, feature_id, period_start, amount)
  SELECT p_clinic_id, v_feature_id, v_period, p_amount
  WHERE v_limit IS NULL OR p_amount <= v_limit
  ON CONFLICT (clinic_id, feature_id, period_start)
  DO UPDATE SET
    amount = public.feature_usage.amount + EXCLUDED.amount,
    updated_at = now()
  WHERE v_limit IS NULL
     OR public.feature_usage.amount + EXCLUDED.amount <= v_limit
  RETURNING amount INTO v_amount;

  IF v_amount IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'QUOTA_EXCEEDED',
      'period_start', v_period
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'amount', v_amount,
    'period_start', v_period,
    'limit', to_jsonb(v_limit)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Existing clinic backfill → legacy + active (once, idempotent)
-- MUST run before the INSERT trigger so existing rows are not treated as "new".
-- ---------------------------------------------------------------------------
INSERT INTO public.clinic_entitlement_subscriptions (
  clinic_id,
  plan_id,
  status,
  starts_at,
  trial_ends_at,
  metadata
)
SELECT
  c.id,
  p.id,
  'active',
  now(),
  NULL,
  jsonb_build_object('source', 'legacy_backfill', 'migration', '121_commercial_entitlements')
FROM public.clinics c
JOIN public.plans p ON p.key = 'legacy'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.clinic_entitlement_subscriptions s
  WHERE s.clinic_id = c.id
    AND s.status IN ('trialing', 'active')
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- New clinic onboarding → trial + trialing (never legacy / internal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboard_clinic_entitlement_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clinic_entitlement_subscriptions s
    WHERE s.clinic_id = NEW.id
      AND s.status IN ('trialing', 'active')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_plan
  FROM public.plans
  WHERE key = 'trial'
    AND is_active
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_PLAN_MISSING';
  END IF;

  IF public.plan_forbidden_for_automatic_assignment(v_plan) THEN
    RAISE EXCEPTION 'ONBOARDING_PLAN_FORBIDDEN';
  END IF;

  INSERT INTO public.clinic_entitlement_subscriptions (
    clinic_id,
    plan_id,
    status,
    starts_at,
    trial_ends_at,
    metadata
  )
  VALUES (
    NEW.id,
    v_plan.id,
    'trialing',
    now(),
    NULL,
    jsonb_build_object('source', 'clinic_insert_trigger')
  );

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboard_clinic_entitlement ON public.clinics;
CREATE TRIGGER trg_onboard_clinic_entitlement
  AFTER INSERT ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.onboard_clinic_entitlement_subscription();

-- ---------------------------------------------------------------------------
-- Grants / revoke
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.plan_forbidden_for_automatic_assignment(public.plans) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_entitlement_clinic_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.feature_usage_period_start(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.entitlement_limit_value(TEXT, BOOLEAN, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.entitlement_default_enabled(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_clinic_feature_entitlement(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_clinic_entitlements(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_feature_usage(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_consume_feature_usage(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.onboard_clinic_entitlement_subscription() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_clinic_entitlements(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_feature_usage(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_consume_feature_usage(UUID, TEXT, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_clinic_entitlements(UUID) IS
  'Carga entitlements resueltos del consultorio en una sola llamada. Valida membresía.';
COMMENT ON FUNCTION public.increment_feature_usage(UUID, TEXT, INTEGER) IS
  'Incremento atómico de uso metered. Rechaza amount <= 0 y features no metered. Valida tenant.';
COMMENT ON FUNCTION public.try_consume_feature_usage(UUID, TEXT, INTEGER) IS
  'Consume cuota en una sola sentencia atómica (límite + uso + incremento).';
COMMENT ON FUNCTION public.onboard_clinic_entitlement_subscription() IS
  'Trigger: clínicas nuevas → trial/trialing. Rechaza planes internos/legacy.';
