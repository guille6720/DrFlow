-- VERIFY 138 — commercial Essential/Pro (staging only).
-- Safe read-only checks. No PHI. No DELETE.

-- 1) Promo columns on clinic_subscriptions
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clinic_subscriptions'
  AND column_name IN (
    'promo_started_at',
    'promo_ends_at',
    'promo_months',
    'promo_price_amount',
    'regular_price_amount',
    'price_currency'
  )
ORDER BY column_name;

-- 2) plan_id check allows essential/pro
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.clinic_subscriptions'::regclass
  AND conname = 'clinic_subscriptions_plan_id_check';

-- 3) essential plan exists; pro public; basic/premium not public for new sale
SELECT key, name, is_public, is_active, display_order
FROM public.plans
WHERE key IN ('essential', 'pro', 'basic', 'premium', 'legacy', 'trial')
ORDER BY display_order, key;

-- 4) Pro / Essential key limits (no clinic reassignment check — counts only)
SELECT p.key AS plan_key, f.key AS feature_key, pf.enabled, pf.value
FROM public.plan_features pf
JOIN public.plans p ON p.id = pf.plan_id
JOIN public.features f ON f.id = pf.feature_id
WHERE p.key IN ('essential', 'pro')
  AND f.key IN (
    'professionals.max',
    'storage.max_mb',
    'ai.monthly_requests',
    'ai.enabled',
    'reports.advanced',
    'automation.enabled'
  )
ORDER BY p.key, f.key;

-- 5) Invariant: clinics row count unchanged by this verify (informational)
SELECT count(*) AS clinics_count FROM public.clinics;
