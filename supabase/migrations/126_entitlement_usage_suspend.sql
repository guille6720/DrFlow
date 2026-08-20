-- Phase 11: metered consume respects commercial suspension; superadmin can expire overrides.
-- Depends on 125 (clinic_current_entitlement_subscription_id) and 121 consume RPCs.
-- Does not replace Mercado Pago clinic_subscriptions. Does not auto-apply to production.

DO $$
BEGIN
  IF to_regprocedure('public.clinic_current_entitlement_subscription_id(uuid)') IS NULL
    OR to_regprocedure('public.try_consume_feature_usage(uuid, text, integer)') IS NULL
    OR to_regprocedure('public.increment_feature_usage(uuid, text, integer)') IS NULL
    OR to_regprocedure('public.assert_entitlement_superadmin()') IS NULL
  THEN
    RAISE EXCEPTION 'MISSING_ENTITLEMENT_CATALOG'
      USING HINT = 'Aplicá 121–125 antes de 126_entitlement_usage_suspend.sql.';
  END IF;
END $$;

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
        AND s.status IN ('past_due', 'cancelled', 'expired')
    )
    AND COALESCE(p_source, '') IS DISTINCT FROM 'override';
$$;

COMMENT ON FUNCTION public.entitlement_metered_commercially_blocked(UUID, TEXT) IS
  'True when the current commercial row is suspended and the resolved source is not an override.';

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
  v_resolved RECORD;
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

  SELECT * INTO v_resolved
  FROM public.resolve_clinic_feature_entitlement(p_clinic_id, p_feature_key);

  IF public.entitlement_metered_commercially_blocked(p_clinic_id, v_resolved.source) THEN
    RAISE EXCEPTION 'COMMERCIAL_SUSPENDED';
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
  IF public.entitlement_metered_commercially_blocked(p_clinic_id, v_resolved.source) THEN
    RAISE EXCEPTION 'COMMERCIAL_SUSPENDED';
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

CREATE OR REPLACE FUNCTION public.clear_clinic_feature_override(
  p_clinic_id UUID,
  p_feature_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature public.features%ROWTYPE;
  v_cleared INTEGER := 0;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  SELECT * INTO v_feature FROM public.features WHERE key = trim(p_feature_key);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNKNOWN_FEATURE';
  END IF;

  UPDATE public.clinic_feature_overrides
  SET
    ends_at = now(),
    updated_at = now()
  WHERE clinic_id = p_clinic_id
    AND feature_id = v_feature.id
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now());

  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'feature_key', v_feature.key,
    'cleared', v_cleared
  );
END;
$$;

REVOKE ALL ON FUNCTION public.entitlement_metered_commercially_blocked(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_feature_usage(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_consume_feature_usage(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_clinic_feature_override(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.increment_feature_usage(UUID, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.try_consume_feature_usage(UUID, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_clinic_feature_override(UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.try_consume_feature_usage(UUID, TEXT, INTEGER) IS
  'Atomic quota consume. Suspended commercial status blocks unless the resolved source is override.';
COMMENT ON FUNCTION public.clear_clinic_feature_override(UUID, TEXT) IS
  'Superadmin: expire live overrides for a clinic feature. Does not delete history.';
