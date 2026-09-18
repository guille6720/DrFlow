-- Product entitlements: product.clinic / product.geriatrics
-- Additive only. Staging-first. Never apply to production from this workstream.
-- Source of truth for platform products (Superadmin-only). Distinct from commercial plans.
-- Depends on: clinics, profiles, audit_logs, is_superadmin(), user_clinic_ids().
-- assert_entitlement_superadmin: provided here if 122 not yet applied.

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

-- ---------------------------------------------------------------------------
-- clinic_products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL CHECK (product_key IN ('clinic', 'geriatrics')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinic_products_unique UNIQUE (clinic_id, product_key)
);

COMMENT ON TABLE public.clinic_products IS
  'Productos de plataforma por clínica (clinic / geriatrics). Solo Superadmin puede mutar.';

CREATE INDEX IF NOT EXISTS idx_clinic_products_clinic
  ON public.clinic_products (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_products_enabled
  ON public.clinic_products (clinic_id, product_key)
  WHERE enabled = true;

-- Backfill: existing clinics keep Clínica ON, Geriatría OFF (preserves current DrFlow).
INSERT INTO public.clinic_products (clinic_id, product_key, enabled)
SELECT c.id, 'clinic', true
FROM public.clinics c
ON CONFLICT (clinic_id, product_key) DO NOTHING;

INSERT INTO public.clinic_products (clinic_id, product_key, enabled)
SELECT c.id, 'geriatrics', false
FROM public.clinics c
ON CONFLICT (clinic_id, product_key) DO NOTHING;

-- New clinics: seed both rows (clinic ON by default for onboarding continuity; geriatrics OFF).
CREATE OR REPLACE FUNCTION public.seed_clinic_products_on_clinic_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clinic_products (clinic_id, product_key, enabled)
  VALUES
    (NEW.id, 'clinic', true),
    (NEW.id, 'geriatrics', false)
  ON CONFLICT (clinic_id, product_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_clinic_products ON public.clinics;
CREATE TRIGGER trg_seed_clinic_products
  AFTER INSERT ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_clinic_products_on_clinic_insert();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.clinic_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_products_select ON public.clinic_products;
CREATE POLICY clinic_products_select ON public.clinic_products
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR clinic_id IN (SELECT public.user_clinic_ids())
  );

-- No INSERT/UPDATE/DELETE for authenticated — mutations via SECURITY DEFINER RPC only.

REVOKE ALL ON public.clinic_products FROM PUBLIC;
GRANT SELECT ON public.clinic_products TO authenticated;
GRANT ALL ON public.clinic_products TO service_role;

-- ---------------------------------------------------------------------------
-- Read helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_clinic_products(p_clinic_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic BOOLEAN := false;
  v_geri BOOLEAN := false;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_superadmin()
     AND NOT (p_clinic_id IN (SELECT public.user_clinic_ids())) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT COALESCE(bool_or(enabled) FILTER (WHERE product_key = 'clinic'), false),
         COALESCE(bool_or(enabled) FILTER (WHERE product_key = 'geriatrics'), false)
  INTO v_clinic, v_geri
  FROM public.clinic_products
  WHERE clinic_id = p_clinic_id;

  RETURN jsonb_build_object(
    'clinic_id', p_clinic_id,
    'product.clinic', v_clinic,
    'product.geriatrics', v_geri
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_products(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_products(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Superadmin-only setter (audited)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_clinic_product(
  p_clinic_id UUID,
  p_product_key TEXT,
  p_enabled BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old BOOLEAN;
  v_new BOOLEAN;
  v_actor UUID;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;
  IF p_product_key IS NULL OR p_product_key NOT IN ('clinic', 'geriatrics') THEN
    RAISE EXCEPTION 'INVALID_PRODUCT_KEY';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'ENABLED_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  v_actor := auth.uid();

  SELECT enabled INTO v_old
  FROM public.clinic_products
  WHERE clinic_id = p_clinic_id AND product_key = p_product_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.clinic_products (clinic_id, product_key, enabled, updated_by)
    VALUES (p_clinic_id, p_product_key, p_enabled, v_actor)
    RETURNING enabled INTO v_new;
    v_old := false;
  ELSE
    UPDATE public.clinic_products
    SET
      enabled = p_enabled,
      updated_at = now(),
      updated_by = v_actor
    WHERE clinic_id = p_clinic_id AND product_key = p_product_key
    RETURNING enabled INTO v_new;
  END IF;

  INSERT INTO public.audit_logs (
    clinic_id,
    user_id,
    entity_type,
    entity_id,
    action,
    module,
    what,
    old_values,
    new_values,
    metadata
  ) VALUES (
    p_clinic_id,
    v_actor,
    'clinic_product',
    p_clinic_id,
    'update',
    'settings',
    format('Producto %s %s', p_product_key, CASE WHEN v_new THEN 'activado' ELSE 'desactivado' END),
    jsonb_build_object('product_key', p_product_key, 'enabled', COALESCE(v_old, false)),
    jsonb_build_object('product_key', p_product_key, 'enabled', v_new),
    jsonb_build_object(
      'product_key', p_product_key,
      'reason', NULLIF(trim(COALESCE(p_reason, '')), ''),
      'source', 'superadmin_set_clinic_product'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'clinic_id', p_clinic_id,
    'product_key', p_product_key,
    'enabled', v_new,
    'previous_enabled', COALESCE(v_old, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_clinic_product(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_clinic_product(UUID, TEXT, BOOLEAN, TEXT) TO service_role;

-- Explicit deny helper for non-superadmin attempts (app also enforces).
CREATE OR REPLACE FUNCTION public.assert_cannot_set_clinic_product_as_member()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_superadmin() OR COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'FORBIDDEN_PRODUCT_ENTITLEMENT';
END;
$$;

NOTIFY pgrst, 'reload schema';
