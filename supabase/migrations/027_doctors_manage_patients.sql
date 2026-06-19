-- Permite a médicos del consultorio crear y desactivar pacientes (RLS).

DROP POLICY IF EXISTS patients_insert ON patients;
CREATE POLICY patients_insert ON patients FOR INSERT
  WITH CHECK (
    can_manage_clinic(clinic_id)
    OR is_doctor_in_clinic(clinic_id)
    OR user_role_in_clinic(clinic_id) = 'patient'
  );

DROP POLICY IF EXISTS patients_update ON patients;
CREATE POLICY patients_update ON patients FOR UPDATE
  USING (
    can_manage_clinic(clinic_id)
    OR is_doctor_in_clinic(clinic_id)
    OR user_id = auth.uid()
  );
