-- Inventario esquema producción (solo lectura). Ejecutar PRIMERO en SQL Editor.
-- No asume clinic_entitlement_subscriptions — detecta qué migraciones faltan.

-- A) Tablas clave (true = existe)
SELECT
  to_regclass('public.clinic_subscriptions') IS NOT NULL AS has_clinic_subscriptions,
  to_regclass('public.plans') IS NOT NULL AS has_plans,
  to_regclass('public.features') IS NOT NULL AS has_features,
  to_regclass('public.clinic_entitlement_subscriptions') IS NOT NULL AS has_entitlement_subs,
  to_regclass('public.consent_records') IS NOT NULL AS has_consent_records,
  to_regclass('public.privacy_rights_requests') IS NOT NULL AS has_privacy_rights,
  to_regclass('public.clinic_subscription_payments') IS NOT NULL AS has_mp_payments;

-- B) Columnas promo 138 en clinic_subscriptions
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clinic_subscriptions'
  AND column_name IN (
    'promo_ends_at',
    'promo_price_amount',
    'promo_started_at',
    'regular_price_amount'
  )
ORDER BY 1;

-- C) Conteos base (sin PHI)
SELECT
  (SELECT count(*)::int FROM public.clinics) AS clinics,
  (SELECT count(*)::int FROM public.patients) AS patients,
  (SELECT count(*)::int FROM public.clinical_records) AS clinical_records;

-- D) Acceso actual (siempre disponible pre/post 121)
SELECT
  count(*) FILTER (WHERE trial_ends_at IS NULL)::int AS clinics_trial_null,
  count(*) FILTER (WHERE trial_ends_at > now())::int AS clinics_trial_active,
  count(*) FILTER (WHERE trial_ends_at IS NOT NULL AND trial_ends_at <= now())::int AS clinics_trial_expired
FROM public.clinics;

-- E) Suscripción Mercado Pago (modelo pre-121 / paralelo)
SELECT plan_id, status::text AS status, count(*)::int AS n
FROM public.clinic_subscriptions
GROUP BY 1, 2
ORDER BY 1, 2;

-- F) Entitlements (solo si has_entitlement_subs = true en A)
-- Descomentar si la query A devolvió has_entitlement_subs = true:
-- SELECT p.key AS plan_key, s.status, count(*)::int AS n
-- FROM public.clinic_entitlement_subscriptions s
-- JOIN public.plans p ON p.id = s.plan_id
-- GROUP BY 1, 2
-- ORDER BY 1, 2;
