-- NexClinic / DrFlow — Premium patients.max = unlimited
-- Target: PRODUCTION (nipqdarduknydqptqzup)
-- Apply in Supabase Dashboard → SQL Editor (production project only).
--
-- Additive only: does NOT touch patients, clinical records, or other plan limits.
-- Convention: SQL/JSON null = unlimited (never use 999999).

BEGIN;

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

COMMIT;

-- Verify (read-only):
-- SELECT p.key, pf.enabled, pf.value
-- FROM public.plan_features pf
-- JOIN public.plans p ON p.id = pf.plan_id
-- JOIN public.features f ON f.id = pf.feature_id
-- WHERE f.key = 'patients.max'
-- ORDER BY p.key;
