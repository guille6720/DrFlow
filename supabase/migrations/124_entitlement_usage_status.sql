-- Phase 4: commercial usage snapshot + superadmin subscription status.
-- Depends on 121 (catalog + feature_usage) and 122 (assert_entitlement_superadmin).
-- Does not replace Mercado Pago clinic_subscriptions. Does not auto-apply to production.

DO $$
BEGIN
  IF to_regprocedure('public.get_clinic_entitlements(uuid)') IS NULL
    OR to_regprocedure('public.assert_entitlement_superadmin()') IS NULL
  THEN
    RAISE EXCEPTION 'MISSING_ENTITLEMENT_CATALOG'
      USING HINT = 'Aplicá 121, 122 y 123 antes de 124_entitlement_usage_status.sql.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_clinic_entitlement_usage(p_clinic_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period DATE := public.feature_usage_period_start();
  v_usage JSONB;
BEGIN
  PERFORM public.assert_entitlement_clinic_access(p_clinic_id);

  SELECT COALESCE(jsonb_object_agg(f.key, COALESCE(u.amount, 0)), '{}'::jsonb)
    INTO v_usage
  FROM public.features f
  LEFT JOIN public.feature_usage u
    ON u.feature_id = f.id
   AND u.clinic_id = p_clinic_id
   AND u.period_start = v_period
  WHERE f.is_active
    AND f.usage_metered;

  RETURN jsonb_build_object(
    'ok', true,
    'clinic_id', p_clinic_id,
    'period_start', v_period,
    'usage', COALESCE(v_usage, '{}'::jsonb)
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
  IF v_status NOT IN ('past_due', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  SELECT id INTO v_sub_id
  FROM public.clinic_entitlement_subscriptions
  WHERE clinic_id = p_clinic_id
    AND status IN ('trialing', 'active', 'past_due')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'NO_LIVE_SUBSCRIPTION';
  END IF;

  UPDATE public.clinic_entitlement_subscriptions
  SET
    status = v_status,
    cancelled_at = CASE WHEN v_status = 'cancelled' THEN now() ELSE cancelled_at END,
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

REVOKE ALL ON FUNCTION public.get_clinic_entitlement_usage(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_clinic_entitlement_status(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_clinic_entitlement_usage(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_clinic_entitlement_status(UUID, TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_clinic_entitlement_usage(UUID) IS
  'Current UTC-month metered usage for a clinic. Membership or service_role.';
COMMENT ON FUNCTION public.set_clinic_entitlement_status(UUID, TEXT, TEXT) IS
  'Superadmin: past_due / cancelled / expired on the live commercial subscription. Does not touch Mercado Pago.';
