-- Phase 3: metered usage from workers (service_role) and GRANT on consume RPCs.
-- Depends on 121 (get_clinic_entitlements / increment_feature_usage / try_consume_feature_usage)
-- and should run after 122. Does not replace Mercado Pago clinic_subscriptions.
-- Does not auto-apply to production.

-- Fail with a clear hint if 121 was not applied yet (GRANT would otherwise raise 42883).
DO $$
BEGIN
  IF to_regprocedure('public.get_clinic_entitlements(uuid)') IS NULL
    OR to_regprocedure('public.increment_feature_usage(uuid, text, integer)') IS NULL
    OR to_regprocedure('public.try_consume_feature_usage(uuid, text, integer)') IS NULL
  THEN
    RAISE EXCEPTION 'MISSING_ENTITLEMENT_CATALOG'
      USING HINT = 'Aplicá primero 121_commercial_entitlements.sql, después 122_entitlement_superadmin.sql, y recién 123_entitlement_usage_service_role.sql.';
  END IF;
END $$;

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
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN;
  END IF;
  IF NOT (is_superadmin() OR user_role_in_clinic(p_clinic_id) IS NOT NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_entitlements(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_feature_usage(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_consume_feature_usage(UUID, TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.assert_entitlement_clinic_access(UUID) IS
  'Clinic tenant check for entitlement RPCs. Authenticated members/superadmin, or service_role for jobs.';
