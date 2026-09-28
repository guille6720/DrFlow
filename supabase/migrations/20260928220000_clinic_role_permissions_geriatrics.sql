-- Adds the Geriatrics permissions (viewGeriatrics, manageGeriatrics) to the per-clinic role matrix.
-- Additive: no rows are created, so every role keeps the code defaults (same behavior as before).
-- The allowed key list now lives in one helper used by the CHECK constraint and the writer RPC.
-- Rollback: rollback/20260928220000_clinic_role_permissions_geriatrics.down.sql

CREATE OR REPLACE FUNCTION public.clinic_manageable_permission_keys()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'manageAppointments', 'managePatients', 'managePatientsAdmin', 'viewClinicalRecords',
    'viewPharmacology', 'editClinicalRecords', 'issuePrescriptions', 'viewReports',
    'managePayments', 'manageCashRegister', 'manageWaitingRoom', 'manageAdminDocuments',
    'importPatients', 'exportPatients', 'importClinicalRecords', 'exportClinicalRecords',
    'bulkExportData', 'viewGeriatrics', 'manageGeriatrics'
  ]::TEXT[];
$$;

REVOKE ALL ON FUNCTION public.clinic_manageable_permission_keys() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clinic_manageable_permission_keys() TO authenticated, service_role;

ALTER TABLE public.clinic_role_permissions
  DROP CONSTRAINT IF EXISTS clinic_role_permissions_permission_key_check;
ALTER TABLE public.clinic_role_permissions
  ADD CONSTRAINT clinic_role_permissions_permission_key_check
  CHECK (permission_key = ANY (public.clinic_manageable_permission_keys()));

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
  v_allowed TEXT[] := public.clinic_manageable_permission_keys();
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
