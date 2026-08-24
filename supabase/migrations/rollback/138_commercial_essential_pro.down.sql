-- Rollback helper for 138_commercial_essential_pro (staging only).
-- WARNING: Does NOT delete the essential plan row (may be referenced).
-- Does NOT reassign clinics. Partial rollback of promo columns only when unused.

-- Drop promo columns if no commercial snapshots depend on them (manual gate).
-- ALTER TABLE clinic_subscriptions DROP COLUMN IF EXISTS promo_started_at;
-- ALTER TABLE clinic_subscriptions DROP COLUMN IF EXISTS promo_ends_at;
-- ALTER TABLE clinic_subscriptions DROP COLUMN IF EXISTS promo_months;
-- ALTER TABLE clinic_subscriptions DROP COLUMN IF EXISTS promo_price_amount;
-- ALTER TABLE clinic_subscriptions DROP COLUMN IF EXISTS regular_price_amount;
-- ALTER TABLE clinic_subscriptions DROP COLUMN IF EXISTS price_currency;

-- Restore plan_id check without essential/pro only if no rows use those plan_ids:
-- ALTER TABLE clinic_subscriptions DROP CONSTRAINT IF EXISTS clinic_subscriptions_plan_id_check;
-- ALTER TABLE clinic_subscriptions ADD CONSTRAINT clinic_subscriptions_plan_id_check
--   CHECK (plan_id IN ('solo', 'consultorio', 'clinica'));

SELECT '138 rollback is intentional no-op by default — review comments before applying drops.' AS note;
