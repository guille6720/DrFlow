-- RLS audit hardening (058): tighten permissive policies found in static audit.
-- Does NOT drop valid policies from prior migrations — replaces overly broad FOR ALL
-- where staff-role or admin scoping was missing.

-- ---------------------------------------------------------------------------
-- Helper: operational staff (excludes patient portal membership)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_clinic_staff(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_superadmin()
    OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'doctor', 'secretary');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION is_clinic_staff IS
  'True for clinic_admin, doctor, secretary, or superadmin — excludes patient role.';

-- ---------------------------------------------------------------------------
-- clinic_jobs: SELECT aligned with INSERT (053) — job payloads may be sensitive
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS clinic_jobs_select ON clinic_jobs;
CREATE POLICY clinic_jobs_select ON clinic_jobs FOR SELECT
  USING (
    is_superadmin()
    OR (
      clinic_id IN (SELECT user_clinic_ids())
      AND user_role_in_clinic(clinic_id) IN ('clinic_admin', 'doctor', 'secretary')
    )
  );

-- ---------------------------------------------------------------------------
-- clinic_observability_events: admin read; tenant-scoped staff write
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS observability_events_select ON clinic_observability_events;
CREATE POLICY observability_events_select ON clinic_observability_events FOR SELECT
  USING (
    is_superadmin()
    OR (
      clinic_id IS NOT NULL
      AND user_role_in_clinic(clinic_id) = 'clinic_admin'
    )
  );

DROP POLICY IF EXISTS observability_events_insert ON clinic_observability_events;
CREATE POLICY observability_events_insert ON clinic_observability_events FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR (
      clinic_id IS NOT NULL
      AND is_clinic_staff(clinic_id)
    )
  );

-- ---------------------------------------------------------------------------
-- telemedicine_sessions: split permissive ALL — room URLs are sensitive
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS telemedicine_sessions_all ON telemedicine_sessions;

CREATE POLICY telemedicine_sessions_select ON telemedicine_sessions FOR SELECT
  USING (
    is_superadmin()
    OR can_view_clinical(clinic_id)
    OR can_manage_clinic(clinic_id)
  );

CREATE POLICY telemedicine_sessions_insert ON telemedicine_sessions FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR can_manage_clinic(clinic_id)
    OR is_doctor_in_clinic(clinic_id)
  );

CREATE POLICY telemedicine_sessions_update ON telemedicine_sessions FOR UPDATE
  USING (
    is_superadmin()
    OR can_manage_clinic(clinic_id)
    OR is_doctor_in_clinic(clinic_id)
  );

CREATE POLICY telemedicine_sessions_delete ON telemedicine_sessions FOR DELETE
  USING (
    is_superadmin()
    OR can_manage_clinic(clinic_id)
    OR is_doctor_in_clinic(clinic_id)
  );

-- ---------------------------------------------------------------------------
-- payments: align with managePayments (excludes doctor role)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS payments_all ON payments;

CREATE POLICY payments_select ON payments FOR SELECT
  USING (is_superadmin() OR can_manage_clinic(clinic_id));

CREATE POLICY payments_insert ON payments FOR INSERT
  WITH CHECK (is_superadmin() OR can_manage_clinic(clinic_id));

CREATE POLICY payments_update ON payments FOR UPDATE
  USING (is_superadmin() OR can_manage_clinic(clinic_id));

CREATE POLICY payments_delete ON payments FOR DELETE
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

-- ---------------------------------------------------------------------------
-- consent_records: clinical/admin read; writes via SECURITY DEFINER RPC
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS consent_records_all ON consent_records;

CREATE POLICY consent_records_select ON consent_records FOR SELECT
  USING (
    is_superadmin()
    OR can_view_clinical(clinic_id)
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

-- ---------------------------------------------------------------------------
-- reminder_logs: staff only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS reminder_logs_all ON reminder_logs;

CREATE POLICY reminder_logs_select ON reminder_logs FOR SELECT
  USING (is_superadmin() OR is_clinic_staff(clinic_id));

CREATE POLICY reminder_logs_insert ON reminder_logs FOR INSERT
  WITH CHECK (is_superadmin() OR is_clinic_staff(clinic_id));

CREATE POLICY reminder_logs_update ON reminder_logs FOR UPDATE
  USING (is_superadmin() OR is_clinic_staff(clinic_id));

CREATE POLICY reminder_logs_delete ON reminder_logs FOR DELETE
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

-- ---------------------------------------------------------------------------
-- patient_app_share_log: staff only (managePatients app guard)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS patient_app_share_log_select ON patient_app_share_log;
CREATE POLICY patient_app_share_log_select ON patient_app_share_log FOR SELECT
  USING (is_superadmin() OR is_clinic_staff(clinic_id));

DROP POLICY IF EXISTS patient_app_share_log_insert ON patient_app_share_log;
CREATE POLICY patient_app_share_log_insert ON patient_app_share_log FOR INSERT
  WITH CHECK (is_superadmin() OR is_clinic_staff(clinic_id));

DROP POLICY IF EXISTS patient_app_share_log_update ON patient_app_share_log;
CREATE POLICY patient_app_share_log_update ON patient_app_share_log FOR UPDATE
  USING (is_superadmin() OR is_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------------
-- availability_rules / schedule_blocks: staff writes; members retain read
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS availability_rules_all ON availability_rules;

CREATE POLICY availability_rules_select ON availability_rules FOR SELECT
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY availability_rules_insert ON availability_rules FOR INSERT
  WITH CHECK (is_superadmin() OR is_clinic_staff(clinic_id));

CREATE POLICY availability_rules_update ON availability_rules FOR UPDATE
  USING (is_superadmin() OR is_clinic_staff(clinic_id));

CREATE POLICY availability_rules_delete ON availability_rules FOR DELETE
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) IN ('clinic_admin', 'secretary')
  );

DROP POLICY IF EXISTS schedule_blocks_all ON schedule_blocks;

CREATE POLICY schedule_blocks_select ON schedule_blocks FOR SELECT
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY schedule_blocks_insert ON schedule_blocks FOR INSERT
  WITH CHECK (is_superadmin() OR is_clinic_staff(clinic_id));

CREATE POLICY schedule_blocks_update ON schedule_blocks FOR UPDATE
  USING (is_superadmin() OR is_clinic_staff(clinic_id));

CREATE POLICY schedule_blocks_delete ON schedule_blocks FOR DELETE
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) IN ('clinic_admin', 'secretary')
  );
