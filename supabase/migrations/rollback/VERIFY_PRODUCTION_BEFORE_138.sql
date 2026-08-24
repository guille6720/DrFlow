-- PRE-FLIGHT producción — planes Essential/Pro (solo lectura, sin PHI).
-- Ejecutar ANTES de 138_commercial_essential_pro.sql en Supabase PRODUCTION.
-- Guardar resultado (screenshot o export) para comparar DESPUÉS.

-- 1) Inventario clínicas / datos (conteos, no nombres)
SELECT
  (SELECT count(*)::int FROM public.clinics) AS clinics,
  (SELECT count(*)::int FROM public.patients) AS patients,
  (SELECT count(*)::int FROM public.clinical_records) AS clinical_records;

-- 2) Plan comercial actual por clínica (entitlements — NO se modifica en 138)
SELECT p.key AS plan_key, s.status, count(*)::int AS n
FROM public.clinic_entitlement_subscriptions s
JOIN public.plans p ON p.id = s.plan_id
GROUP BY 1, 2
ORDER BY 1, 2;

-- 3) Suscripciones MP (si existen)
SELECT plan_id, status, count(*)::int AS n
FROM public.clinic_subscriptions
GROUP BY 1, 2
ORDER BY 1, 2;

-- 4) ¿Ya aplicada 138? (promo columns)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clinic_subscriptions'
  AND column_name IN ('promo_ends_at', 'promo_price_amount')
ORDER BY 1;
