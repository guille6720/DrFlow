-- P0 security hardening: storage RLS, patient_attachments, public booking occupancy RPC,
-- helper search_path, audit_logs restrict, performance indexes.

-- ---------------------------------------------------------------------------
-- Legacy RLS helpers: enforce search_path (CVE-class hardening)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_superadmin FROM profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION user_clinic_ids()
RETURNS SETOF UUID AS $$
  SELECT clinic_id FROM clinic_members
  WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION user_role_in_clinic(p_clinic_id UUID)
RETURNS user_role AS $$
  SELECT role FROM clinic_members
  WHERE user_id = auth.uid() AND clinic_id = p_clinic_id AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_manage_clinic(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_superadmin() OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'secretary');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_doctor_in_clinic(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_superadmin() OR user_role_in_clinic(p_clinic_id) = 'doctor';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION clinical_file_clinic_id(p_path text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF((string_to_array(p_path, '/'))[1], '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- Storage: SELECT must match INSERT/DELETE (can_view_clinical, not user_clinic_ids)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS clinical_files_select ON storage.objects;
CREATE POLICY clinical_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'clinical-files'
    AND (
      is_superadmin()
      OR can_view_clinical(clinical_file_clinic_id(name))
    )
  );

-- ---------------------------------------------------------------------------
-- patient_attachments: clinical staff only (align with can_view_clinical in 034)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS patient_attachments_all ON patient_attachments;

CREATE POLICY patient_attachments_select ON patient_attachments FOR SELECT
  USING (is_superadmin() OR can_view_clinical(clinic_id));

CREATE POLICY patient_attachments_insert ON patient_attachments FOR INSERT
  WITH CHECK (is_superadmin() OR can_view_clinical(clinic_id));

CREATE POLICY patient_attachments_update ON patient_attachments FOR UPDATE
  USING (is_superadmin() OR can_view_clinical(clinic_id));

CREATE POLICY patient_attachments_delete ON patient_attachments FOR DELETE
  USING (is_superadmin() OR can_view_clinical(clinic_id));

-- ---------------------------------------------------------------------------
-- Public booking: remove anon SELECT on full appointments row (PHI leak via patient_id, notes)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS appointments_anon_availability_select ON appointments;

CREATE OR REPLACE FUNCTION public.get_public_booking_occupancy(
  p_slug TEXT,
  p_professional_id UUID
)
RETURNS TABLE (start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
BEGIN
  SELECT pbl.clinic_id INTO v_clinic_id
  FROM public_booking_links pbl
  WHERE pbl.slug = p_slug AND pbl.is_active = true;

  IF v_clinic_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.start_at, a.end_at
  FROM appointments a
  WHERE a.clinic_id = v_clinic_id
    AND a.professional_id = p_professional_id
    AND a.status <> 'cancelled'
    AND a.start_at >= now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_booking_occupancy(TEXT, UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- audit_logs: admin-only read (staff operativo no debe ver trazabilidad completa)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (
    is_superadmin()
    OR (
      clinic_id IS NOT NULL
      AND user_role_in_clinic(clinic_id) = 'clinic_admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Indexes for common tenant + patient queries
-- idx_clinical_records_clinic_created lives in 054 (061 drops duplicate name).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_patient_attachments_patient
  ON patient_attachments(patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_prof_start
  ON appointments(clinic_id, professional_id, start_at)
  WHERE status <> 'cancelled';
