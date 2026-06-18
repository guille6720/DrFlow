-- Permitir al creador de una clínica vincular su propia cuenta como clinic_admin
-- cuando aún no hay miembros (registro inicial).
DROP POLICY IF EXISTS clinic_members_insert ON clinic_members;

CREATE POLICY clinic_members_insert ON clinic_members FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) = 'clinic_admin'
    OR (
      user_id = auth.uid()
      AND role = 'clinic_admin'
      AND NOT EXISTS (
        SELECT 1 FROM clinic_members cm WHERE cm.clinic_id = clinic_members.clinic_id
      )
    )
  );
