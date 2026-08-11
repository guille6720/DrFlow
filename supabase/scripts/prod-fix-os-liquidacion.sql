-- Production fix: Fase 4B — run BEFORE or AFTER partial 103 apply. Safe to re-run.
-- Fixes: function can_manage_cash(uuid) does not exist (migration 034 caja not applied).

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS doctors_can_access_cash BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION can_manage_cash(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'secretary')
    OR (
      user_role_in_clinic(p_clinic_id) = 'doctor'
      AND EXISTS (
        SELECT 1 FROM clinics c
        WHERE c.id = p_clinic_id AND COALESCE(c.doctors_can_access_cash, true)
      )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Re-apply RLS policies (only if os_* tables exist from migration 103)
DO $$
BEGIN
  IF to_regclass('public.os_fee_schedules') IS NULL THEN
    RAISE NOTICE 'os_fee_schedules missing — apply supabase/migrations/103_os_liquidacion.sql first';
    RETURN;
  END IF;

  ALTER TABLE os_fee_schedules ENABLE ROW LEVEL SECURITY;
  ALTER TABLE os_billable_items ENABLE ROW LEVEL SECURITY;
  ALTER TABLE os_liquidation_batches ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS os_fee_schedules_all ON os_fee_schedules;
  CREATE POLICY os_fee_schedules_all ON os_fee_schedules FOR ALL
    USING (can_manage_cash(clinic_id))
    WITH CHECK (can_manage_cash(clinic_id));

  DROP POLICY IF EXISTS os_billable_items_all ON os_billable_items;
  CREATE POLICY os_billable_items_all ON os_billable_items FOR ALL
    USING (can_manage_cash(clinic_id))
    WITH CHECK (can_manage_cash(clinic_id));

  DROP POLICY IF EXISTS os_liquidation_batches_all ON os_liquidation_batches;
  CREATE POLICY os_liquidation_batches_all ON os_liquidation_batches FOR ALL
    USING (can_manage_cash(clinic_id))
    WITH CHECK (can_manage_cash(clinic_id));
END $$;
