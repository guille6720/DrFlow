-- Phase 10: current commercial subscription includes suspended statuses.
-- Prefer trialing/active; otherwise the latest past_due/cancelled/expired row.
-- Superadmin can restore active/trialing. Assign also closes past_due.
-- Does not replace Mercado Pago clinic_subscriptions. Does not auto-apply to production.

DO $$
BEGIN
  IF to_regprocedure('public.get_clinic_entitlements(uuid)') IS NULL
    OR to_regprocedure('public.assign_clinic_entitlement_plan(uuid, text, text)') IS NULL
    OR to_regprocedure('public.set_clinic_entitlement_status(uuid, text, text)') IS NULL
  THEN
    RAISE EXCEPTION 'MISSING_ENTITLEMENT_CATALOG'
      USING HINT = 'Aplicá 121, 122, 123 y 124 antes de 125_entitlement_current_subscription.sql.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.clinic_current_entitlement_subscription_id(p_clinic_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.clinic_entitlement_subscriptions s
  WHERE s.clinic_id = p_clinic_id
  ORDER BY
    CASE WHEN s.status IN ('trialing', 'active') THEN 0 ELSE 1 END,
    s.created_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.clinic_current_entitlement_subscription_id(UUID) IS
  'Internal: live trialing/active wins; else latest suspended commercial row.';

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
    WHERE s.id = public.clinic_current_entitlement_subscription_id(p_clinic_id)
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
  v_sub_id UUID;
BEGIN
  PERFORM public.assert_entitlement_clinic_access(p_clinic_id);

  v_sub_id := public.clinic_current_entitlement_subscription_id(p_clinic_id);

  SELECT p.key, s.plan_id, s.status, s.trial_ends_at
    INTO v_plan_key, v_plan_id, v_status, v_trial_ends_at
  FROM public.clinic_entitlement_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.id = v_sub_id;

  SELECT COALESCE(jsonb_object_agg(q.key, q.body), '{}'::jsonb)
    INTO v_features
  FROM (
    WITH live_sub AS (
      SELECT s.plan_id
      FROM public.clinic_entitlement_subscriptions s
      WHERE s.id = v_sub_id
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

CREATE OR REPLACE FUNCTION public.assign_clinic_entitlement_plan(
  p_clinic_id UUID,
  p_plan_key TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_clinic_id UUID;
  v_status TEXT;
  v_sub_id UUID;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;
  IF p_plan_key IS NULL OR trim(p_plan_key) = '' THEN
    RAISE EXCEPTION 'ONBOARDING_PLAN_MISSING';
  END IF;

  SELECT id INTO v_clinic_id FROM public.clinics WHERE id = p_clinic_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  SELECT * INTO v_plan
  FROM public.plans
  WHERE key = trim(p_plan_key)
    AND is_active
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_PLAN_MISSING';
  END IF;

  UPDATE public.clinic_entitlement_subscriptions
  SET
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  WHERE clinic_id = p_clinic_id
    AND status IN ('trialing', 'active', 'past_due');

  v_status := CASE WHEN v_plan.key = 'trial' THEN 'trialing' ELSE 'active' END;

  INSERT INTO public.clinic_entitlement_subscriptions (
    clinic_id,
    plan_id,
    status,
    starts_at,
    trial_ends_at,
    metadata
  )
  VALUES (
    p_clinic_id,
    v_plan.id,
    v_status,
    now(),
    NULL,
    jsonb_build_object(
      'source', CASE
        WHEN NULLIF(trim(COALESCE(p_reason, '')), '') = 'mercadopago_payment' THEN 'mercadopago_payment'
        ELSE 'superadmin_assign'
      END,
      'reason', NULLIF(trim(COALESCE(p_reason, '')), ''),
      'assigned_by', auth.uid()
    )
  )
  RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', v_sub_id,
    'plan_key', v_plan.key,
    'status', v_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_clinic_entitlement_status(
  p_clinic_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_sub_id UUID;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  v_status := lower(trim(COALESCE(p_status, '')));
  IF v_status NOT IN ('trialing', 'active', 'past_due', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  SELECT id INTO v_sub_id
  FROM public.clinic_entitlement_subscriptions
  WHERE id = public.clinic_current_entitlement_subscription_id(p_clinic_id)
  FOR UPDATE;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'NO_LIVE_SUBSCRIPTION';
  END IF;

  UPDATE public.clinic_entitlement_subscriptions
  SET
    status = v_status,
    cancelled_at = CASE
      WHEN v_status = 'cancelled' THEN now()
      WHEN v_status IN ('trialing', 'active') THEN NULL
      ELSE cancelled_at
    END,
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'status_source', 'superadmin_status',
      'status_reason', NULLIF(trim(COALESCE(p_reason, '')), ''),
      'status_set_by', auth.uid()
    )
  WHERE id = v_sub_id;

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', v_sub_id,
    'status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.clinic_current_entitlement_subscription_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_clinic_feature_entitlement(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_clinic_entitlements(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_clinic_entitlement_plan(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_clinic_entitlement_status(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_clinic_entitlements(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_clinic_entitlement_plan(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_clinic_entitlement_status(UUID, TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_clinic_entitlements(UUID) IS
  'Resolved entitlements. Current sub is live trialing/active, else latest suspended row.';
COMMENT ON FUNCTION public.set_clinic_entitlement_status(UUID, TEXT, TEXT) IS
  'Superadmin: trialing/active restore or past_due/cancelled/expired. Does not touch Mercado Pago.';
