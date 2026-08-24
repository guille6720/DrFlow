-- Uso reciente personal por profesional (términos clínicos, sin datos de pacientes).

CREATE TABLE IF NOT EXISTS public.clinical_recent_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('diagnosis', 'treatment', 'medication')),
  fingerprint TEXT NOT NULL,
  label TEXT NOT NULL,
  -- Solo metadatos de catálogo/término clínico. Nunca patient_id ni historia.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  use_count INTEGER NOT NULL DEFAULT 1 CHECK (use_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinical_recent_usage_label_nonempty CHECK (trim(label) <> ''),
  CONSTRAINT clinical_recent_usage_fingerprint_nonempty CHECK (trim(fingerprint) <> ''),
  CONSTRAINT clinical_recent_usage_user_kind_fingerprint_uidx UNIQUE (user_id, kind, fingerprint)
);

COMMENT ON TABLE public.clinical_recent_usage IS
  'Términos clínicos usados recientemente por user_id. Sin PHI ni vínculo a pacientes.';

CREATE INDEX IF NOT EXISTS idx_clinical_recent_usage_user_kind_last
  ON public.clinical_recent_usage (user_id, kind, last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_recent_usage_user_label_trgm
  ON public.clinical_recent_usage USING gin (label gin_trgm_ops);

ALTER TABLE public.clinical_recent_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_recent_usage_select_own ON public.clinical_recent_usage;
CREATE POLICY clinical_recent_usage_select_own ON public.clinical_recent_usage
  FOR SELECT TO authenticated
  USING (is_superadmin() OR user_id = auth.uid());

DROP POLICY IF EXISTS clinical_recent_usage_insert_own ON public.clinical_recent_usage;
CREATE POLICY clinical_recent_usage_insert_own ON public.clinical_recent_usage
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS clinical_recent_usage_update_own ON public.clinical_recent_usage;
CREATE POLICY clinical_recent_usage_update_own ON public.clinical_recent_usage
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS clinical_recent_usage_delete_own ON public.clinical_recent_usage;
CREATE POLICY clinical_recent_usage_delete_own ON public.clinical_recent_usage
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Upsert atómico: registra uso del profesional sin datos de paciente.
CREATE OR REPLACE FUNCTION public.record_clinical_recent_usage(
  p_kind TEXT,
  p_fingerprint TEXT,
  p_label TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_keep_per_kind INTEGER DEFAULT 40
)
RETURNS public.clinical_recent_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.clinical_recent_usage;
  v_keep INTEGER := GREATEST(COALESCE(p_keep_per_kind, 40), 10);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_kind NOT IN ('diagnosis', 'treatment', 'medication') THEN
    RAISE EXCEPTION 'INVALID_KIND';
  END IF;

  IF trim(COALESCE(p_fingerprint, '')) = '' OR trim(COALESCE(p_label, '')) = '' THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  -- Rechazar claves sensibles si alguien las intenta colar en payload.
  IF p_payload ? 'patient_id'
     OR p_payload ? 'clinical_record_id'
     OR p_payload ? 'patient_name'
     OR p_payload ? 'documento'
     OR p_payload ? 'dni'
  THEN
    RAISE EXCEPTION 'SENSITIVE_PAYLOAD_FORBIDDEN';
  END IF;

  INSERT INTO public.clinical_recent_usage AS r (
    user_id, kind, fingerprint, label, payload, last_used_at, use_count
  )
  VALUES (
    v_uid,
    p_kind,
    trim(p_fingerprint),
    left(trim(p_label), 240),
    COALESCE(p_payload, '{}'::jsonb),
    now(),
    1
  )
  ON CONFLICT (user_id, kind, fingerprint)
  DO UPDATE SET
    label = EXCLUDED.label,
    payload = EXCLUDED.payload,
    last_used_at = now(),
    use_count = r.use_count + 1
  RETURNING * INTO v_row;

  -- Mantener solo los N más recientes del kind para este usuario.
  DELETE FROM public.clinical_recent_usage d
  WHERE d.user_id = v_uid
    AND d.kind = p_kind
    AND d.id NOT IN (
      SELECT id
      FROM public.clinical_recent_usage
      WHERE user_id = v_uid AND kind = p_kind
      ORDER BY last_used_at DESC
      LIMIT v_keep
    );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_clinical_recent_usage(TEXT, TEXT, TEXT, JSONB, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_clinical_recent_usage(TEXT, TEXT, TEXT, JSONB, INTEGER) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_recent_usage TO authenticated;
