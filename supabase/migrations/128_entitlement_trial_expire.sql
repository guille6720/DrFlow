-- Phase 13: persist lapsed commercial trials to expired.
-- Frees idx_clinic_entitlement_subs_one_live (trialing/active only).
-- get_clinic_entitlements becomes VOLATILE so the first read after lapse writes expired.
-- Does not touch clinics.trial_ends_at (Mercado Pago / app promo trial).
-- Does not replace clinic_subscriptions. Does not auto-apply to production.

DO $$
BEGIN
  IF to_regprocedure('public.get_clinic_entitlements(uuid)') IS NULL
    OR to_regprocedure('public.entitlement_subscription_is_live(text, timestamptz)') IS NULL
    OR to_regprocedure('public.set_clinic_entitlement_trial_end(uuid, timestamptz, text)') IS NULL
    OR to_regprocedure('public.set_clinic_entitlement_status(uuid, text, text)') IS NULL
  THEN
    RAISE EXCEPTION 'MISSING_ENTITLEMENT_CATALOG'
      USING HINT = 'Aplicá 121–127 antes de 128_entitlement_trial_expire.sql.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.expire_lapsed_clinic_entitlement_trials(p_clinic_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;

  UPDATE public.clinic_entitlement_subscriptions
  SET
    status = 'expired',
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'expired_source', 'lapsed_trial'
    )
  WHERE clinic_id = p_clinic_id
    AND status = 'trialing'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_lapsed_clinic_entitlement_trials(UUID) IS
  'Internal: persist trialing rows whose trial_ends_at has passed to expired. Frees the live unique index.';

CREATE OR REPLACE FUNCTION public.get_clinic_entitlements(p_clinic_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
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
  PERFORM public.expire_lapsed_clinic_entitlement_trials(p_clinic_id);

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

  PERFORM public.expire_lapsed_clinic_entitlement_trials(p_clinic_id);

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', v_sub_id,
    'trial_ends_at', to_jsonb(p_trial_ends_at)
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

  PERFORM public.expire_lapsed_clinic_entitlement_trials(p_clinic_id);

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', v_sub_id,
    'status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.expire_lapsed_clinic_entitlement_trials(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_clinic_entitlements(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_clinic_entitlement_trial_end(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_clinic_entitlement_status(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_clinic_entitlements(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_clinic_entitlement_trial_end(UUID, TIMESTAMPTZ, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_clinic_entitlement_status(UUID, TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_clinic_entitlements(UUID) IS
  'Resolved entitlements. Persists lapsed trialing to expired, then returns the current row.';
COMMENT ON FUNCTION public.set_clinic_entitlement_status(UUID, TEXT, TEXT) IS
  'Superadmin: trialing/active restore or past_due/cancelled/expired. Lapsed trialing is persisted to expired.';
