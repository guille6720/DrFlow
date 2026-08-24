-- Phase 12: honor clinic_entitlement_subscriptions.trial_ends_at when set.
-- Lapsed trialing is not live (same rank as suspended) and consume pauses unless override.
-- Superadmin can set or clear the commercial trial window. Does not touch clinics.trial_ends_at
-- (Mercado Pago / app promo trial). Does not replace clinic_subscriptions.
-- Does not auto-apply to production.

DO $$
BEGIN
  IF to_regprocedure('public.clinic_current_entitlement_subscription_id(uuid)') IS NULL
    OR to_regprocedure('public.get_clinic_entitlements(uuid)') IS NULL
    OR to_regprocedure('public.entitlement_metered_commercially_blocked(uuid, text)') IS NULL
    OR to_regprocedure('public.assert_entitlement_superadmin()') IS NULL
  THEN
    RAISE EXCEPTION 'MISSING_ENTITLEMENT_CATALOG'
      USING HINT = 'Aplicá 121–126 antes de 127_entitlement_trial_window.sql.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.entitlement_subscription_is_live(
  p_status TEXT,
  p_trial_ends_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN p_status = 'active' THEN true
      WHEN p_status = 'trialing'
        AND (p_trial_ends_at IS NULL OR p_trial_ends_at > now()) THEN true
      ELSE false
    END;
$$;

COMMENT ON FUNCTION public.entitlement_subscription_is_live(TEXT, TIMESTAMPTZ) IS
  'Live commercial row: active, or trialing with no window / window still open. NULL trial_ends_at does not expire.';

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
    CASE
      WHEN public.entitlement_subscription_is_live(s.status, s.trial_ends_at) THEN 0
      ELSE 1
    END,
    s.created_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.clinic_current_entitlement_subscription_id(UUID) IS
  'Internal: live trialing/active (honoring trial_ends_at) wins; else latest suspended commercial row.';

CREATE OR REPLACE FUNCTION public.entitlement_metered_commercially_blocked(
  p_clinic_id UUID,
  p_source TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.clinic_entitlement_subscriptions s
      WHERE s.id = public.clinic_current_entitlement_subscription_id(p_clinic_id)
        AND NOT public.entitlement_subscription_is_live(s.status, s.trial_ends_at)
    )
    AND COALESCE(p_source, '') IS DISTINCT FROM 'override';
$$;

COMMENT ON FUNCTION public.entitlement_metered_commercially_blocked(UUID, TEXT) IS
  'True when the current commercial row is not live (suspended or lapsed trial) and the resolved source is not an override.';

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

  IF v_status = 'trialing'
     AND NOT public.entitlement_subscription_is_live(v_status, v_trial_ends_at)
  THEN
    v_status := 'expired';
  END IF;

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

CREATE OR REPLACE FUNCTION public.set_clinic_entitlement_trial_end(
  p_clinic_id UUID,
  p_trial_ends_at TIMESTAMPTZ,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
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
    trial_ends_at = p_trial_ends_at,
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'trial_end_source', 'superadmin_trial_end',
      'trial_end_reason', NULLIF(trim(COALESCE(p_reason, '')), ''),
      'trial_end_set_by', auth.uid()
    )
  WHERE id = v_sub_id;

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', v_sub_id,
    'trial_ends_at', to_jsonb(p_trial_ends_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.entitlement_subscription_is_live(TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clinic_current_entitlement_subscription_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.entitlement_metered_commercially_blocked(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_clinic_entitlements(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_clinic_entitlement_trial_end(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_clinic_entitlements(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_clinic_entitlement_trial_end(UUID, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_clinic_entitlements(UUID) IS
  'Resolved entitlements. Lapsed trialing is returned as expired. Does not mutate the row.';
COMMENT ON FUNCTION public.set_clinic_entitlement_trial_end(UUID, TIMESTAMPTZ, TEXT) IS
  'Superadmin: set or clear commercial trial_ends_at. NULL means no duration. Does not touch clinics.trial_ends_at.';
