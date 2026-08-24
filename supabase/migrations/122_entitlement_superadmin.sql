-- Phase 2: Superadmin assignment of commercial plans and feature overrides.
-- Does not replace Mercado Pago clinic_subscriptions. Does not auto-apply to production.

CREATE OR REPLACE FUNCTION public.assert_entitlement_superadmin()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN;
  END IF;
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
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

  -- Superadmin / service_role may assign internal/legacy. Automatic onboarding cannot.

  UPDATE public.clinic_entitlement_subscriptions
  SET
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  WHERE clinic_id = p_clinic_id
    AND status IN ('trialing', 'active');

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

CREATE OR REPLACE FUNCTION public.upsert_clinic_feature_override(
  p_clinic_id UUID,
  p_feature_key TEXT,
  p_enabled BOOLEAN,
  p_value JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_starts_at TIMESTAMPTZ DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature public.features%ROWTYPE;
  v_id UUID;
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
  IF v_feature.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'FEATURE_INACTIVE';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'FEATURE_DISABLED';
  END IF;

  INSERT INTO public.clinic_feature_overrides (
    clinic_id,
    feature_id,
    enabled,
    value,
    reason,
    starts_at,
    ends_at,
    created_by
  )
  VALUES (
    p_clinic_id,
    v_feature.id,
    p_enabled,
    p_value,
    NULLIF(trim(COALESCE(p_reason, '')), ''),
    p_starts_at,
    p_ends_at,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'override_id', v_id,
    'feature_key', v_feature.key,
    'enabled', p_enabled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assert_entitlement_superadmin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_clinic_entitlement_plan(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_clinic_feature_override(UUID, TEXT, BOOLEAN, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assign_clinic_entitlement_plan(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_clinic_feature_override(UUID, TEXT, BOOLEAN, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

COMMENT ON FUNCTION public.assign_clinic_entitlement_plan(UUID, TEXT, TEXT) IS
  'Superadmin o service_role: asigna plan comercial (incluye legacy). Onboarding automático sigue sin poder asignar legacy.';
COMMENT ON FUNCTION public.upsert_clinic_feature_override(UUID, TEXT, BOOLEAN, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Superadmin o service_role: alta de override comercial (add-on / cuota / ventana temporal).';
