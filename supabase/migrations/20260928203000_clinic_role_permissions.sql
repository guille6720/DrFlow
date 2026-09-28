-- Per-clinic role permission matrix (roles x permissions).
-- Additive and backward compatible: with no rows every role keeps the code defaults (PERMISSIONS in roles.ts).
-- Precedence (app layer, src/core/auth/session.ts):
--   clinic_member_permissions (member) -> clinic_role_permissions (role in clinic) -> code default
-- Rollback: rollback/20260928203000_clinic_role_permissions.down.sql

CREATE TABLE IF NOT EXISTS public.clinic_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  role public.user_role NOT NULL CHECK (role IN ('doctor', 'secretary')),
  permission_key TEXT NOT NULL CHECK (permission_key IN (
    'manageAppointments', 'managePatients', 'managePatientsAdmin', 'viewClinicalRecords',
    'viewPharmacology', 'editClinicalRecords', 'issuePrescriptions', 'viewReports',
    'managePayments', 'manageCashRegister', 'manageWaitingRoom', 'manageAdminDocuments',
    'importPatients', 'exportPatients', 'importClinicalRecords', 'exportClinicalRecords',
    'bulkExportData'
  )),
  granted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT clinic_role_permissions_unique UNIQUE (clinic_id, role, permission_key)
);

COMMENT ON TABLE public.clinic_role_permissions IS
  'Permisos por rol dentro de una clínica. Solo filas distintas al default del código. Escritura vía RPC auditada.';

CREATE INDEX IF NOT EXISTS idx_clinic_role_permissions_clinic_role
  ON public.clinic_role_permissions (clinic_id, role);

ALTER TABLE public.clinic_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_role_permissions_select ON public.clinic_role_permissions;
CREATE POLICY clinic_role_permissions_select ON public.clinic_role_permissions
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR clinic_id IN (SELECT public.user_clinic_ids())
  );

-- Read-only for app roles (Supabase default privileges would otherwise grant ALL, incl. TRUNCATE).
REVOKE ALL ON public.clinic_role_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.clinic_role_permissions TO authenticated;
GRANT ALL ON public.clinic_role_permissions TO service_role;

-- ---------------------------------------------------------------------------
-- Writer: clinic_admin of that clinic or Superadmin. p_changes = {"permissionKey": true|false|null}
-- null removes the row (back to code default). Audited, no PHI.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_clinic_role_permissions(
  p_clinic_id UUID,
  p_role TEXT,
  p_changes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_key TEXT;
  v_value JSONB;
  v_old JSONB;
  v_new JSONB;
  v_allowed TEXT[] := ARRAY[
    'manageAppointments', 'managePatients', 'managePatientsAdmin', 'viewClinicalRecords',
    'viewPharmacology', 'editClinicalRecords', 'issuePrescriptions', 'viewReports',
    'managePayments', 'manageCashRegister', 'manageWaitingRoom', 'manageAdminDocuments',
    'importPatients', 'exportPatients', 'importClinicalRecords', 'exportClinicalRecords',
    'bulkExportData'
  ];
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RAISE EXCEPTION 'NOT_AUTHENTICATED';
    END IF;
    IF NOT public.is_superadmin()
       AND public.user_role_in_clinic(p_clinic_id) IS DISTINCT FROM 'clinic_admin' THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('doctor', 'secretary') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'EMPTY_CHANGES';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_changes)) > 32 THEN
    RAISE EXCEPTION 'TOO_MANY_CHANGES';
  END IF;

  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_changes) LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'INVALID_PERMISSION';
    END IF;
    IF jsonb_typeof(v_value) NOT IN ('boolean', 'null') THEN
      RAISE EXCEPTION 'INVALID_VALUE';
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_object_agg(permission_key, granted), '{}'::jsonb) INTO v_old
  FROM public.clinic_role_permissions
  WHERE clinic_id = p_clinic_id AND role = p_role::public.user_role
    AND permission_key IN (SELECT jsonb_object_keys(p_changes));

  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_changes) LOOP
    IF jsonb_typeof(v_value) = 'null' THEN
      DELETE FROM public.clinic_role_permissions
      WHERE clinic_id = p_clinic_id AND role = p_role::public.user_role AND permission_key = v_key;
    ELSE
      INSERT INTO public.clinic_role_permissions (clinic_id, role, permission_key, granted, updated_by)
      VALUES (p_clinic_id, p_role::public.user_role, v_key, (v_value)::boolean, v_actor)
      ON CONFLICT (clinic_id, role, permission_key)
      DO UPDATE SET granted = EXCLUDED.granted, updated_at = now(), updated_by = EXCLUDED.updated_by;
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_object_agg(permission_key, granted), '{}'::jsonb) INTO v_new
  FROM public.clinic_role_permissions
  WHERE clinic_id = p_clinic_id AND role = p_role::public.user_role
    AND permission_key IN (SELECT jsonb_object_keys(p_changes));

  INSERT INTO public.audit_logs (
    clinic_id, user_id, entity_type, entity_id, action, module, what,
    old_values, new_values, metadata
  ) VALUES (
    p_clinic_id,
    v_actor,
    'clinic_role_permission',
    p_clinic_id,
    'update'::audit_action,
    'settings',
    format('Permisos del rol %s actualizados', p_role),
    v_old,
    v_new,
    jsonb_build_object('role', p_role, 'requested', p_changes, 'source', 'role_permissions_matrix')
  );

  RETURN jsonb_build_object('ok', true, 'role', p_role, 'values', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.set_clinic_role_permissions(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_clinic_role_permissions(UUID, TEXT, JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
