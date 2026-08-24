-- PRE-FLIGHT producción — planes Essential/Pro (solo lectura, sin PHI).
-- Ejecutar ANTES del backlog comercial (121–138) en Supabase PRODUCTION.
-- Si falla "clinic_entitlement_subscriptions does not exist", prod aún no tiene 121:
--   usá VERIFY_PRODUCTION_SCHEMA_INVENTORY.sql y aplicá 121→138 en orden.

-- 0) Inventario rápido de esquema
SELECT
  to_regclass('public.plans') IS NOT NULL AS has_plans,
  to_regclass('public.clinic_entitlement_subscriptions') IS NOT NULL AS has_entitlement_subs;

-- 1) Inventario clínicas / datos (conteos, no nombres)
SELECT
  (SELECT count(*)::int FROM public.clinics) AS clinics,
  (SELECT count(*)::int FROM public.patients) AS patients,
  (SELECT count(*)::int FROM public.clinical_records) AS clinical_records;

-- 2a) Plan comercial — SOLO si prod ya tiene migración 121+
-- (Si da error "relation does not exist", saltá a 2b.)
SELECT p.key AS plan_key, s.status, count(*)::int AS n
FROM public.clinic_entitlement_subscriptions s
JOIN public.plans p ON p.id = s.plan_id
GROUP BY 1, 2
ORDER BY 1, 2;

-- 2b) Producción pre-121: suscripción Mercado Pago + trial en clinics
SELECT plan_id AS plan_key, status::text AS status, count(*)::int AS n
FROM public.clinic_subscriptions
GROUP BY 1, 2
ORDER BY 1, 2;

SELECT
  count(*) FILTER (WHERE trial_ends_at IS NULL)::int AS clinics_trial_null,
  count(*) FILTER (WHERE trial_ends_at > now())::int AS clinics_trial_active,
  count(*) FILTER (WHERE trial_ends_at IS NOT NULL AND trial_ends_at <= now())::int AS clinics_trial_expired
FROM public.clinics;

-- 3) ¿Ya aplicada 138? (promo columns)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clinic_subscriptions'
  AND column_name IN ('promo_ends_at', 'promo_price_amount')
ORDER BY 1;
