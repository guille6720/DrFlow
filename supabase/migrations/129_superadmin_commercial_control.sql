-- Superadmin commercial control panel (staging only).
-- Additive: recommendations + usage thresholds. Does not alter clinical data or Mercado Pago.
-- Do NOT apply to production from this workstream.

CREATE TABLE IF NOT EXISTS public.commercial_usage_thresholds (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  info_pct NUMERIC(5, 2) NOT NULL DEFAULT 70,
  warn_pct NUMERIC(5, 2) NOT NULL DEFAULT 85,
  critical_pct NUMERIC(5, 2) NOT NULL DEFAULT 100,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT commercial_usage_thresholds_order CHECK (
    info_pct > 0 AND warn_pct >= info_pct AND critical_pct >= warn_pct
  )
);

COMMENT ON TABLE public.commercial_usage_thresholds IS
  'Umbrales centralizados de uso comercial (info / warn / critical). Fila única.';

INSERT INTO public.commercial_usage_thresholds (id, info_pct, warn_pct, critical_pct)
VALUES (1, 70, 85, 100)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.clinic_plan_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  current_plan_key TEXT NOT NULL,
  recommended_plan_key TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'manual_review')),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'recommended'
    CHECK (status IN ('recommended', 'reviewed', 'dismissed', 'accepted')),
  signal_fingerprint TEXT NOT NULL DEFAULT '',
  recommended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_plan_recommendations_open
  ON public.clinic_plan_recommendations (clinic_id)
  WHERE status IN ('recommended', 'reviewed');

CREATE INDEX IF NOT EXISTS idx_clinic_plan_recommendations_status
  ON public.clinic_plan_recommendations (status, recommended_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_plan_recommendations_clinic
  ON public.clinic_plan_recommendations (clinic_id, updated_at DESC);

COMMENT ON TABLE public.clinic_plan_recommendations IS
  'Recomendaciones de plan comercial para Superadmin. No cambia planes automáticamente.';

ALTER TABLE public.commercial_usage_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_plan_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_usage_thresholds_select ON public.commercial_usage_thresholds;
CREATE POLICY commercial_usage_thresholds_select ON public.commercial_usage_thresholds
  FOR SELECT TO authenticated
  USING (is_superadmin());

DROP POLICY IF EXISTS clinic_plan_recommendations_select ON public.clinic_plan_recommendations;
CREATE POLICY clinic_plan_recommendations_select ON public.clinic_plan_recommendations
  FOR SELECT TO authenticated
  USING (is_superadmin());

-- Mutations via SECURITY DEFINER RPCs only.
REVOKE ALL ON TABLE public.commercial_usage_thresholds FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.clinic_plan_recommendations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.commercial_usage_thresholds TO authenticated;
GRANT SELECT ON TABLE public.clinic_plan_recommendations TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_clinic_plan_recommendation(
  p_clinic_id UUID,
  p_current_plan_key TEXT,
  p_recommended_plan_key TEXT,
  p_severity TEXT,
  p_score INTEGER,
  p_reasons JSONB,
  p_signal_fingerprint TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.clinic_plan_recommendations%ROWTYPE;
  v_row public.clinic_plan_recommendations%ROWTYPE;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  SELECT * INTO v_existing
  FROM public.clinic_plan_recommendations
  WHERE clinic_id = p_clinic_id
    AND status IN ('recommended', 'reviewed')
  ORDER BY recommended_at DESC
  LIMIT 1;

  IF FOUND AND v_existing.status = 'dismissed' THEN
    NULL; -- unreachable due to filter
  END IF;

  -- If dismissed with same fingerprint, do not reopen.
  IF EXISTS (
    SELECT 1
    FROM public.clinic_plan_recommendations d
    WHERE d.clinic_id = p_clinic_id
      AND d.status = 'dismissed'
      AND d.signal_fingerprint = COALESCE(p_signal_fingerprint, '')
      AND d.dismissed_at > now() - interval '30 days'
  ) AND NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'dismissed_same_signal');
  END IF;

  IF FOUND AND v_existing.signal_fingerprint = COALESCE(p_signal_fingerprint, '') THEN
    UPDATE public.clinic_plan_recommendations
    SET
      score = COALESCE(p_score, score),
      reasons = COALESCE(p_reasons, reasons),
      severity = COALESCE(p_severity, severity),
      current_plan_key = COALESCE(p_current_plan_key, current_plan_key),
      recommended_plan_key = COALESCE(p_recommended_plan_key, recommended_plan_key),
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_row;
  ELSIF FOUND THEN
    UPDATE public.clinic_plan_recommendations
    SET
      current_plan_key = p_current_plan_key,
      recommended_plan_key = p_recommended_plan_key,
      severity = p_severity,
      score = p_score,
      reasons = COALESCE(p_reasons, '[]'::jsonb),
      signal_fingerprint = COALESCE(p_signal_fingerprint, ''),
      status = 'recommended',
      recommended_at = now(),
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.clinic_plan_recommendations (
      clinic_id,
      current_plan_key,
      recommended_plan_key,
      severity,
      score,
      reasons,
      signal_fingerprint,
      status
    )
    VALUES (
      p_clinic_id,
      p_current_plan_key,
      p_recommended_plan_key,
      p_severity,
      COALESCE(p_score, 0),
      COALESCE(p_reasons, '[]'::jsonb),
      COALESCE(p_signal_fingerprint, ''),
      'recommended'
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_clinic_plan_recommendation_status(
  p_recommendation_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.clinic_plan_recommendations%ROWTYPE;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_status NOT IN ('recommended', 'reviewed', 'dismissed', 'accepted') THEN
    RAISE EXCEPTION 'INVALID_RECOMMENDATION_STATUS';
  END IF;

  UPDATE public.clinic_plan_recommendations
  SET
    status = p_status,
    notes = COALESCE(p_notes, notes),
    reviewed_at = CASE WHEN p_status = 'reviewed' THEN now() ELSE reviewed_at END,
    dismissed_at = CASE WHEN p_status = 'dismissed' THEN now() ELSE dismissed_at END,
    accepted_at = CASE WHEN p_status = 'accepted' THEN now() ELSE accepted_at END,
    reviewed_by = auth.uid(),
    updated_at = now()
  WHERE id = p_recommendation_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECOMMENDATION_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_commercial_plan(
  p_plan_key TEXT,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_display_order INTEGER DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.plans%ROWTYPE;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  IF p_plan_key = 'legacy' AND p_is_public IS TRUE THEN
    RAISE EXCEPTION 'LEGACY_CANNOT_BE_PUBLIC';
  END IF;

  UPDATE public.plans
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    display_order = COALESCE(p_display_order, display_order),
    is_public = CASE
      WHEN p_plan_key = 'legacy' THEN false
      ELSE COALESCE(p_is_public, is_public)
    END,
    is_active = COALESCE(p_is_active, is_active),
    metadata = COALESCE(p_metadata, metadata),
    updated_at = now()
  WHERE key = p_plan_key
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'key', v_row.key,
    'is_public', v_row.is_public,
    'is_active', v_row.is_active
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_feature_active(
  p_feature_key TEXT,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.features%ROWTYPE;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  UPDATE public.features
  SET is_active = p_is_active, updated_at = now()
  WHERE key = p_feature_key
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FEATURE_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object('ok', true, 'key', v_row.key, 'is_active', v_row.is_active);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_plan_feature_assignment(
  p_plan_key TEXT,
  p_feature_key TEXT,
  p_enabled BOOLEAN,
  p_value NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_feature_id UUID;
  v_value JSONB;
BEGIN
  PERFORM public.assert_entitlement_superadmin();

  SELECT id INTO v_plan_id FROM public.plans WHERE key = p_plan_key;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'PLAN_NOT_FOUND'; END IF;

  SELECT id INTO v_feature_id FROM public.features WHERE key = p_feature_key;
  IF v_feature_id IS NULL THEN RAISE EXCEPTION 'FEATURE_NOT_FOUND'; END IF;

  v_value := CASE WHEN p_value IS NULL THEN NULL ELSE to_jsonb(p_value) END;

  INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
  VALUES (v_plan_id, v_feature_id, p_enabled, v_value)
  ON CONFLICT (plan_id, feature_id) DO UPDATE
  SET
    enabled = EXCLUDED.enabled,
    value = EXCLUDED.value,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'plan_key', p_plan_key,
    'feature_key', p_feature_key,
    'enabled', p_enabled,
    'value', v_value
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_clinic_plan_recommendation(UUID, TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_clinic_plan_recommendation_status(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_commercial_plan(TEXT, TEXT, TEXT, INTEGER, BOOLEAN, BOOLEAN, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_feature_active(TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_plan_feature_assignment(TEXT, TEXT, BOOLEAN, NUMERIC) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upsert_clinic_plan_recommendation(UUID, TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_clinic_plan_recommendation_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_commercial_plan(TEXT, TEXT, TEXT, INTEGER, BOOLEAN, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_feature_active(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_plan_feature_assignment(TEXT, TEXT, BOOLEAN, NUMERIC) TO authenticated;
