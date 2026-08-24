-- POST-FLIGHT producción — verificar 138 sin perder clínicas existentes.

-- Conteos deben coincidir con PRE-FLIGHT (clinics/patients/HC)
SELECT
  (SELECT count(*)::int FROM public.clinics) AS clinics,
  (SELECT count(*)::int FROM public.patients) AS patients,
  (SELECT count(*)::int FROM public.clinical_records) AS clinical_records;

-- Entitlements: mismas filas, mismos planes (138 NO reasigna)
SELECT p.key AS plan_key, s.status, count(*)::int AS n
FROM public.clinic_entitlement_subscriptions s
JOIN public.plans p ON p.id = s.plan_id
GROUP BY 1, 2
ORDER BY 1, 2;

-- Catálogo nuevo
SELECT key, name, is_public, is_active
FROM public.plans
WHERE key IN ('essential', 'pro', 'legacy', 'basic', 'premium')
ORDER BY key;

-- Matriz Essential / Pro
SELECT p.key, f.key AS feature, pf.enabled, pf.value
FROM public.plan_features pf
JOIN public.plans p ON p.id = pf.plan_id
JOIN public.features f ON f.id = pf.feature_id
WHERE p.key IN ('essential', 'pro')
  AND f.key IN ('professionals.max', 'storage.max_mb', 'ai.monthly_requests', 'ai.enabled')
ORDER BY 1, 2;
