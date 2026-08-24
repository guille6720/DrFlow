-- Favoritos clínicos personales por usuario (no compartidos entre profesionales).

CREATE TABLE IF NOT EXISTS public.clinical_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('diagnosis', 'treatment', 'medication')),
  fingerprint TEXT NOT NULL,
  label TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinical_favorites_label_nonempty CHECK (trim(label) <> ''),
  CONSTRAINT clinical_favorites_fingerprint_nonempty CHECK (trim(fingerprint) <> ''),
  CONSTRAINT clinical_favorites_user_kind_fingerprint_uidx UNIQUE (user_id, kind, fingerprint)
);

COMMENT ON TABLE public.clinical_favorites IS
  'Favoritos personales de diagnóstico/tratamiento/medicamento por user_id. Aislados por RLS.';

CREATE INDEX IF NOT EXISTS idx_clinical_favorites_user_kind_sort
  ON public.clinical_favorites (user_id, kind, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_favorites_user_label_trgm
  ON public.clinical_favorites USING gin (label gin_trgm_ops);

ALTER TABLE public.clinical_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_favorites_select_own ON public.clinical_favorites;
CREATE POLICY clinical_favorites_select_own ON public.clinical_favorites
  FOR SELECT TO authenticated
  USING (is_superadmin() OR user_id = auth.uid());

DROP POLICY IF EXISTS clinical_favorites_insert_own ON public.clinical_favorites;
CREATE POLICY clinical_favorites_insert_own ON public.clinical_favorites
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS clinical_favorites_update_own ON public.clinical_favorites;
CREATE POLICY clinical_favorites_update_own ON public.clinical_favorites
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS clinical_favorites_delete_own ON public.clinical_favorites;
CREATE POLICY clinical_favorites_delete_own ON public.clinical_favorites
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.clinical_favorites_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_favorites_updated_at ON public.clinical_favorites;
CREATE TRIGGER trg_clinical_favorites_updated_at
  BEFORE UPDATE ON public.clinical_favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.clinical_favorites_touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_favorites TO authenticated;
