-- RLS performance hardening (090): index policy hot paths; normalize helpers without weakening tenant isolation.

-- ---------------------------------------------------------------------------
-- Indexes supporting RLS helper lookups (user_clinic_ids, user_role_in_clinic, portal)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clinic_members_user_active_clinic
  ON clinic_members (user_id, clinic_id)
  WHERE is_active = true;

COMMENT ON INDEX idx_clinic_members_user_active_clinic IS
  'RLS hot path: user_clinic_ids() and user_role_in_clinic() filter by user_id + is_active.';

CREATE INDEX IF NOT EXISTS idx_patients_user_id
  ON patients (user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_patients_user_id IS
  'RLS hot path: patient portal subqueries on patients.user_id = auth.uid().';

-- ---------------------------------------------------------------------------
-- 084 appointment module: use SECURITY DEFINER user_clinic_ids() + is_clinic_staff()
-- (inline clinic_members subqueries run as invoker; stacked helpers duplicate lookups)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS appointment_status_history_select ON appointment_status_history;
CREATE POLICY appointment_status_history_select ON appointment_status_history
  FOR SELECT USING (
    is_superadmin() OR clinic_id IN (SELECT user_clinic_ids())
  );

DROP POLICY IF EXISTS appointment_status_history_insert ON appointment_status_history;
CREATE POLICY appointment_status_history_insert ON appointment_status_history
  FOR INSERT WITH CHECK (
    is_superadmin() OR is_clinic_staff(clinic_id)
  );

DROP POLICY IF EXISTS waiting_list_select ON waiting_list;
CREATE POLICY waiting_list_select ON waiting_list
  FOR SELECT USING (
    is_superadmin() OR clinic_id IN (SELECT user_clinic_ids())
  );

DROP POLICY IF EXISTS waiting_list_write ON waiting_list;
CREATE POLICY waiting_list_write ON waiting_list
  FOR ALL USING (
    is_superadmin() OR is_clinic_staff(clinic_id)
  )
  WITH CHECK (
    is_superadmin() OR is_clinic_staff(clinic_id)
  );

DROP POLICY IF EXISTS appointment_notification_queue_insert ON appointment_notification_queue;
CREATE POLICY appointment_notification_queue_insert ON appointment_notification_queue
  FOR INSERT WITH CHECK (
    is_superadmin() OR is_clinic_staff(clinic_id)
  );

-- SELECT/UPDATE remain admin/secretary-only (can_manage_clinic) — doctors must not manage the queue.

-- ---------------------------------------------------------------------------
-- 058 clinic_jobs: redundant user_clinic_ids + user_role_in_clinic → is_clinic_staff
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS clinic_jobs_select ON clinic_jobs;
CREATE POLICY clinic_jobs_select ON clinic_jobs FOR SELECT
  USING (is_clinic_staff(clinic_id));
