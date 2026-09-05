-- Staging: lock Premium patients.max to unlimited (SQL NULL / JSON null).
-- Additive only — does not touch clinical data or other plan limits.
-- Convention: null = unlimited (never use sentinel caps like 999999).

UPDATE public.plan_features pf
SET
  value = NULL,
  enabled = true,
  updated_at = now()
FROM public.plans p
JOIN public.features f ON f.key = 'patients.max'
WHERE pf.plan_id = p.id
  AND pf.feature_id = f.id
  AND p.key = 'premium';

-- Ensure the row exists even if a prior seed skipped it.
INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, f.id, true, NULL
FROM public.plans p
CROSS JOIN public.features f
WHERE p.key = 'premium'
  AND f.key = 'patients.max'
ON CONFLICT (plan_id, feature_id) DO UPDATE
SET
  value = NULL,
  enabled = true,
  updated_at = now();

COMMENT ON COLUMN public.plan_features.value IS
  'Feature limit payload. For limit-type features, SQL/JSON null means unlimited.';
