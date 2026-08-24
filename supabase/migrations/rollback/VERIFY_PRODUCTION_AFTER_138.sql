-- POST-FLIGHT producción — verificar backlog 121–138 sin perder clínicas existentes.

-- Conteos deben coincidir con PRE-FLIGHT (clinics/patients/HC)
SELECT
  (SELECT count(*)::int FROM public.clinics) AS clinics,
  (SELECT count(*)::int FROM public.patients) AS patients,
  (SELECT count(*)::int FROM public.clinical_records) AS clinical_records;

-- Entitlements (obligatorio después de 121+): una fila active/trialing por clínica existente
SELECT p.key AS plan_key, s.status, count(*)::int AS n
FROM public.clinic_entitlement_subscriptions s
JOIN public.plans p ON p.id = s.plan_id
GROUP BY 1, 2
ORDER BY 1, 2;

-- Clínicas existentes deben estar en legacy/active (backfill 121)
SELECT count(*)::int AS legacy_active_clinics
FROM public.clinic_entitlement_subscriptions s
JOIN public.plans p ON p.id = s.plan_id
WHERE p.key = 'legacy'
  AND s.status = 'active';

-- MP subscriptions sin cambio de plan_id (138 no reasigna filas)
SELECT plan_id, status::text AS status, count(*)::int AS n
FROM public.clinic_subscriptions
GROUP BY 1, 2
ORDER BY 1, 2;

-- Catálogo nuevo
SELECT key, name, is_public, is_active
FROM public.plans
WHERE key IN ('essential', 'pro', 'legacy', 'basic', 'premium', 'trial')
ORDER BY key;

-- Columnas promo 138
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clinic_subscriptions'
  AND column_name IN ('promo_ends_at', 'promo_price_amount', 'regular_price_amount')
ORDER BY 1;

-- Matriz Essential / Pro
SELECT p.key, f.key AS feature, pf.enabled, pf.value
FROM public.plan_features pf
JOIN public.plans p ON p.id = pf.plan_id
JOIN public.features f ON f.id = pf.feature_id
WHERE p.key IN ('essential', 'pro')
  AND f.key IN ('professionals.max', 'storage.max_mb', 'ai.monthly_requests', 'ai.enabled')
ORDER BY 1, 2;
