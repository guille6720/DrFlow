-- ReNaPDiS Phase 3: fiscalization clinic marker (staging readiness).
-- Additive only. Does not weaken RLS. Does not invent Ministry APIs.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS is_fiscalization boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinics.is_fiscalization IS
  'Marks an isolated fiscalization/inspection clinic with synthetic data only. Never production PHI.';

CREATE INDEX IF NOT EXISTS idx_clinics_fiscalization
  ON public.clinics (id)
  WHERE is_fiscalization = true;
