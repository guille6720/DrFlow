-- Phase commercial Essential/Pro (staging).
-- Promo snapshot columns + essential plan + pro matrix retune.
-- Does NOT reassign existing clinic entitlement subscriptions (legacy/basic/etc. untouched).
-- DO NOT run on production without explicit owner authorization.

-- ---------------------------------------------------------------------------
-- clinic_subscriptions: allow essential/pro + promo snapshot
-- ---------------------------------------------------------------------------
ALTER TABLE clinic_subscriptions
  DROP CONSTRAINT IF EXISTS clinic_subscriptions_plan_id_check;

ALTER TABLE clinic_subscriptions
  ADD CONSTRAINT clinic_subscriptions_plan_id_check
  CHECK (plan_id IN ('solo', 'consultorio', 'clinica', 'essential', 'pro'));

ALTER TABLE clinic_subscriptions
  ADD COLUMN IF NOT EXISTS promo_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promo_months INTEGER,
  ADD COLUMN IF NOT EXISTS promo_price_amount INTEGER,
  ADD COLUMN IF NOT EXISTS regular_price_amount INTEGER,
  ADD COLUMN IF NOT EXISTS price_currency TEXT NOT NULL DEFAULT 'ARS';

COMMENT ON COLUMN clinic_subscriptions.promo_started_at IS
  'Promotional window start (subscription activation). Server-side only.';
COMMENT ON COLUMN clinic_subscriptions.promo_ends_at IS
  'End of promotional billing window (activation + 6 billing months).';
COMMENT ON COLUMN clinic_subscriptions.promo_months IS
  'Number of promotional billing months snapshotted at signup (typically 6).';
COMMENT ON COLUMN clinic_subscriptions.promo_price_amount IS
  'Promotional monthly price in whole ARS (matches MP unit_price).';
COMMENT ON COLUMN clinic_subscriptions.regular_price_amount IS
  'Post-promo monthly price in whole ARS snapshotted at signup.';
COMMENT ON COLUMN clinic_subscriptions.price_currency IS
  'Currency for promo/regular amounts (ARS).';

-- ---------------------------------------------------------------------------
-- Commercial catalog: essential + retune pro; hide basic/premium from public sale
-- ---------------------------------------------------------------------------
INSERT INTO public.plans (key, name, description, is_active, is_internal, is_public, display_order, metadata)
VALUES (
  'essential',
  'DrFlow Essential',
  'Para profesionales independientes que necesitan gestionar su consultorio de forma simple y segura.',
  true,
  false,
  true,
  1,
  jsonb_build_object(
    'promo_price_ars', 25000,
    'regular_price_ars', 35000,
    'promo_months', 6,
    'currency', 'ARS'
  )
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  is_internal = false,
  is_public = true,
  display_order = 1,
  metadata = EXCLUDED.metadata,
  updated_at = now();

UPDATE public.plans
SET
  name = 'DrFlow Pro',
  description = 'Para consultorios y equipos médicos que buscan automatización, IA y mayor capacidad.',
  is_public = true,
  is_active = true,
  display_order = 2,
  metadata = jsonb_build_object(
    'promo_price_ars', 40000,
    'regular_price_ars', 55000,
    'promo_months', 6,
    'currency', 'ARS',
    'ai_actions_monthly', 1000
  ),
  updated_at = now()
WHERE key = 'pro';

-- Keep legacy untouched; stop public sale of basic/premium (superadmin may still assign).
UPDATE public.plans
SET is_public = false, updated_at = now()
WHERE key IN ('basic', 'premium');

-- Ensure essential has the same core boolean features as trial/basic core set
INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, f.id, true, f.default_value
FROM public.plans p
CROSS JOIN public.features f
WHERE p.key = 'essential'
  AND f.key IN (
    'core.dashboard',
    'patients.enabled',
    'appointments.enabled',
    'waiting_room.enabled',
    'clinical_history.enabled',
    'consultations.enabled',
    'medical_orders.enabled',
    'templates.enabled',
    'documents.enabled',
    'pdf_export.enabled',
    'data_export.enabled',
    'reports.basic',
    'audit.enabled',
    'settings.enabled',
    'team.enabled'
  )
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = true,
  updated_at = now();

-- Essential limits
UPDATE public.plan_features pf
SET
  enabled = true,
  value = CASE f.key
    WHEN 'users.max' THEN '3'::jsonb
    WHEN 'professionals.max' THEN '1'::jsonb
    WHEN 'patients.max' THEN 'null'::jsonb
    WHEN 'storage.max_mb' THEN '5120'::jsonb
    WHEN 'ai.monthly_requests' THEN '0'::jsonb
    WHEN 'ai.monthly_transcriptions' THEN '0'::jsonb
    WHEN 'whatsapp.monthly_messages' THEN '0'::jsonb
    WHEN 'automations.max_active' THEN '0'::jsonb
    ELSE pf.value
  END,
  updated_at = now()
FROM public.plans p, public.features f
WHERE pf.plan_id = p.id
  AND pf.feature_id = f.id
  AND p.key = 'essential'
  AND f.key IN (
    'users.max',
    'professionals.max',
    'patients.max',
    'storage.max_mb',
    'ai.monthly_requests',
    'ai.monthly_transcriptions',
    'whatsapp.monthly_messages',
    'automations.max_active'
  );

INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, f.id, true,
  CASE f.key
    WHEN 'users.max' THEN '3'::jsonb
    WHEN 'professionals.max' THEN '1'::jsonb
    WHEN 'patients.max' THEN 'null'::jsonb
    WHEN 'storage.max_mb' THEN '5120'::jsonb
    WHEN 'ai.monthly_requests' THEN '0'::jsonb
    WHEN 'ai.monthly_transcriptions' THEN '0'::jsonb
    WHEN 'whatsapp.monthly_messages' THEN '0'::jsonb
    WHEN 'automations.max_active' THEN '0'::jsonb
    ELSE f.default_value
  END
FROM public.plans p
CROSS JOIN public.features f
WHERE p.key = 'essential'
  AND f.feature_type = 'limit'
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  value = EXCLUDED.value,
  updated_at = now();

-- Essential: AI / advanced automation / advanced reports OFF
UPDATE public.plan_features pf
SET enabled = false, updated_at = now()
FROM public.plans p, public.features f
WHERE pf.plan_id = p.id
  AND pf.feature_id = f.id
  AND p.key = 'essential'
  AND f.key IN (
    'ai.enabled',
    'ai.clinical_summary',
    'ai.document_generation',
    'ai.transcription',
    'automation.enabled',
    'automation.follow_up',
    'reports.advanced',
    'whatsapp.enabled',
    'whatsapp.reminders'
  );

INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, f.id, false, f.default_value
FROM public.plans p
CROSS JOIN public.features f
WHERE p.key = 'essential'
  AND f.key IN (
    'ai.enabled',
    'ai.clinical_summary',
    'ai.document_generation',
    'ai.transcription',
    'automation.enabled',
    'automation.follow_up',
    'reports.advanced',
    'whatsapp.enabled',
    'whatsapp.reminders'
  )
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = false,
  updated_at = now();

-- Pro: enable AI + automation + advanced reports; limits
UPDATE public.plan_features pf
SET enabled = true, updated_at = now()
FROM public.plans p, public.features f
WHERE pf.plan_id = p.id
  AND pf.feature_id = f.id
  AND p.key = 'pro'
  AND f.key IN (
    'ai.enabled',
    'ai.clinical_summary',
    'ai.document_generation',
    'automation.enabled',
    'automation.follow_up',
    'reports.advanced',
    'whatsapp.reminders',
    'data_export.enabled',
    'pdf_export.enabled'
  );

INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, f.id, true, f.default_value
FROM public.plans p
CROSS JOIN public.features f
WHERE p.key = 'pro'
  AND f.key IN (
    'ai.enabled',
    'ai.clinical_summary',
    'ai.document_generation',
    'automation.enabled',
    'automation.follow_up',
    'reports.advanced',
    'whatsapp.reminders',
    'data_export.enabled',
    'pdf_export.enabled'
  )
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = true,
  updated_at = now();

UPDATE public.plan_features pf
SET
  enabled = true,
  value = CASE f.key
    WHEN 'professionals.max' THEN '5'::jsonb
    WHEN 'patients.max' THEN 'null'::jsonb
    WHEN 'storage.max_mb' THEN '25600'::jsonb
    WHEN 'ai.monthly_requests' THEN '1000'::jsonb
    WHEN 'automations.max_active' THEN '20'::jsonb
    ELSE pf.value
  END,
  updated_at = now()
FROM public.plans p, public.features f
WHERE pf.plan_id = p.id
  AND pf.feature_id = f.id
  AND p.key = 'pro'
  AND f.key IN (
    'professionals.max',
    'patients.max',
    'storage.max_mb',
    'ai.monthly_requests',
    'automations.max_active'
  );

INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, f.id, true,
  CASE f.key
    WHEN 'professionals.max' THEN '5'::jsonb
    WHEN 'patients.max' THEN 'null'::jsonb
    WHEN 'storage.max_mb' THEN '25600'::jsonb
    WHEN 'ai.monthly_requests' THEN '1000'::jsonb
    WHEN 'automations.max_active' THEN '20'::jsonb
    ELSE f.default_value
  END
FROM public.plans p
CROSS JOIN public.features f
WHERE p.key = 'pro'
  AND f.key IN (
    'professionals.max',
    'patients.max',
    'storage.max_mb',
    'ai.monthly_requests',
    'automations.max_active'
  )
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  enabled = true,
  value = EXCLUDED.value,
  updated_at = now();
