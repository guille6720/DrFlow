-- Row Level Security Policies for DrFlow

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_record_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_record_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemedicine_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_booking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_superadmin FROM profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_clinic_ids()
RETURNS SETOF UUID AS $$
  SELECT clinic_id FROM clinic_members
  WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_role_in_clinic(p_clinic_id UUID)
RETURNS user_role AS $$
  SELECT role FROM clinic_members
  WHERE user_id = auth.uid() AND clinic_id = p_clinic_id AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_manage_clinic(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_superadmin() OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'secretary');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_view_clinical(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_superadmin() OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'doctor', 'secretary');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_doctor_in_clinic(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_superadmin() OR user_role_in_clinic(p_clinic_id) = 'doctor';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (id = auth.uid() OR is_superadmin());

CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = auth.uid() OR is_superadmin());

-- Clinics
CREATE POLICY clinics_select ON clinics FOR SELECT
  USING (is_superadmin() OR id IN (SELECT user_clinic_ids()));

CREATE POLICY clinics_insert ON clinics FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY clinics_update ON clinics FOR UPDATE
  USING (is_superadmin() OR user_role_in_clinic(id) = 'clinic_admin');

-- Clinic members
CREATE POLICY clinic_members_select ON clinic_members FOR SELECT
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY clinic_members_insert ON clinic_members FOR INSERT
  WITH CHECK (is_superadmin() OR user_role_in_clinic(clinic_id) = 'clinic_admin');

CREATE POLICY clinic_members_update ON clinic_members FOR UPDATE
  USING (is_superadmin() OR user_role_in_clinic(clinic_id) = 'clinic_admin');

-- Generic clinic-scoped tables (read)
CREATE POLICY specialties_select ON specialties FOR SELECT
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));
CREATE POLICY specialties_manage ON specialties FOR ALL
  USING (can_manage_clinic(clinic_id));

CREATE POLICY locations_select ON locations FOR SELECT
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));
CREATE POLICY locations_manage ON locations FOR ALL
  USING (can_manage_clinic(clinic_id));

CREATE POLICY professionals_select ON professionals FOR SELECT
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));
CREATE POLICY professionals_manage ON professionals FOR ALL
  USING (can_manage_clinic(clinic_id));

CREATE POLICY consultation_reasons_select ON consultation_reasons FOR SELECT
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));
CREATE POLICY consultation_reasons_manage ON consultation_reasons FOR ALL
  USING (can_manage_clinic(clinic_id));

CREATE POLICY clinical_templates_select ON clinical_templates FOR SELECT
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));
CREATE POLICY clinical_templates_manage ON clinical_templates FOR ALL
  USING (can_manage_clinic(clinic_id) OR is_doctor_in_clinic(clinic_id));

-- Patients
CREATE POLICY patients_select ON patients FOR SELECT
  USING (
    is_superadmin()
    OR clinic_id IN (SELECT user_clinic_ids())
    OR user_id = auth.uid()
  );

CREATE POLICY patients_insert ON patients FOR INSERT
  WITH CHECK (can_manage_clinic(clinic_id) OR user_role_in_clinic(clinic_id) = 'patient');

CREATE POLICY patients_update ON patients FOR UPDATE
  USING (can_manage_clinic(clinic_id) OR user_id = auth.uid());

CREATE POLICY patient_attachments_all ON patient_attachments FOR ALL
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

-- Availability & blocks
CREATE POLICY availability_rules_all ON availability_rules FOR ALL
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY schedule_blocks_all ON schedule_blocks FOR ALL
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

-- Appointments
CREATE POLICY appointments_select ON appointments FOR SELECT
  USING (
    is_superadmin()
    OR clinic_id IN (SELECT user_clinic_ids())
    OR patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

CREATE POLICY appointments_insert ON appointments FOR INSERT
  WITH CHECK (can_manage_clinic(clinic_id) OR is_doctor_in_clinic(clinic_id));

CREATE POLICY appointments_update ON appointments FOR UPDATE
  USING (can_manage_clinic(clinic_id) OR is_doctor_in_clinic(clinic_id));

-- Clinical records (restricted)
CREATE POLICY clinical_records_select ON clinical_records FOR SELECT
  USING (can_view_clinical(clinic_id));

CREATE POLICY clinical_records_insert ON clinical_records FOR INSERT
  WITH CHECK (is_doctor_in_clinic(clinic_id) OR user_role_in_clinic(clinic_id) = 'clinic_admin');

CREATE POLICY clinical_records_update ON clinical_records FOR UPDATE
  USING (is_doctor_in_clinic(clinic_id) OR user_role_in_clinic(clinic_id) = 'clinic_admin');

CREATE POLICY clinical_record_attachments_all ON clinical_record_attachments FOR ALL
  USING (can_view_clinical(clinic_id));

CREATE POLICY clinical_record_audit_select ON clinical_record_audit FOR SELECT
  USING (can_view_clinical(clinic_id));

CREATE POLICY clinical_record_audit_insert ON clinical_record_audit FOR INSERT
  WITH CHECK (can_view_clinical(clinic_id));

CREATE POLICY prescription_drafts_all ON prescription_drafts FOR ALL
  USING (can_view_clinical(clinic_id));

-- Reminders, telemedicine, payments
CREATE POLICY reminder_logs_all ON reminder_logs FOR ALL
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY telemedicine_sessions_all ON telemedicine_sessions FOR ALL
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY payments_all ON payments FOR ALL
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY public_booking_links_all ON public_booking_links FOR ALL
  USING (can_manage_clinic(clinic_id));

CREATE POLICY consent_records_all ON consent_records FOR ALL
  USING (is_superadmin() OR clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (is_superadmin() OR (clinic_id IS NOT NULL AND clinic_id IN (SELECT user_clinic_ids())));

CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Storage bucket policies (run after creating bucket 'clinical-files')
-- CREATE POLICY "Clinical files access" ON storage.objects FOR ALL
--   USING (bucket_id = 'clinical-files' AND auth.uid() IS NOT NULL);
