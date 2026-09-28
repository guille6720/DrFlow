-- STAGING ONLY. Everything rolls back through the final RAISE EXCEPTION.
DO $$
DECLARE
  v_admin UUID; v_clinic UUID; v_other UUID; v_nonadmin UUID;
  v_out TEXT := '';
  v_res JSONB;
  v_cnt INT;
BEGIN
  SELECT m.user_id, m.clinic_id INTO v_admin, v_clinic
  FROM clinic_members m JOIN profiles p ON p.id = m.user_id
  WHERE m.role = 'clinic_admin' AND m.is_active AND NOT COALESCE(p.is_superadmin, false)
  LIMIT 1;
  SELECT id INTO v_other FROM clinics WHERE id <> v_clinic LIMIT 1;
  SELECT m.user_id INTO v_nonadmin
  FROM clinic_members m JOIN profiles p ON p.id = m.user_id
  WHERE m.role IN ('doctor','secretary') AND m.is_active AND NOT COALESCE(p.is_superadmin, false)
  LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_res := public.set_clinic_role_permissions(v_clinic, 'secretary', jsonb_build_object('viewReports', true));
  v_out := v_out || 'admin_own=' || (v_res->>'ok') || '; ';

  SELECT count(*) INTO v_cnt FROM clinic_role_permissions WHERE clinic_id = v_clinic;
  v_out := v_out || 'admin_reads_own=' || v_cnt || '; ';

  BEGIN
    PERFORM public.set_clinic_role_permissions(v_other, 'secretary', jsonb_build_object('viewReports', true));
    v_out := v_out || 'admin_other=ALLOWED(BAD); ';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || 'admin_other=' || SQLERRM || '; ';
  END;

  BEGIN
    PERFORM public.set_clinic_role_permissions(v_clinic, 'clinic_admin', jsonb_build_object('viewReports', false));
    v_out := v_out || 'role_admin=ALLOWED(BAD); ';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || 'role_admin=' || SQLERRM || '; ';
  END;

  BEGIN
    INSERT INTO clinic_role_permissions (clinic_id, role, permission_key, granted)
    VALUES (v_clinic, 'doctor', 'viewReports', false);
    v_out := v_out || 'direct_insert=ALLOWED(BAD); ';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || 'direct_insert=' || SQLERRM || '; ';
  END;

  SELECT count(*) INTO v_cnt FROM audit_logs WHERE entity_type = 'clinic_role_permission' AND clinic_id = v_clinic;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO v_cnt FROM audit_logs WHERE entity_type = 'clinic_role_permission' AND clinic_id = v_clinic;
  v_out := v_out || 'audit_rows=' || v_cnt || '; ';

  IF v_nonadmin IS NULL THEN
    UPDATE clinic_members SET role = 'doctor' WHERE user_id = v_admin AND clinic_id = v_clinic;
    v_nonadmin := v_admin;
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_nonadmin, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.set_clinic_role_permissions(v_clinic, 'doctor', jsonb_build_object('viewReports', true));
    v_out := v_out || 'nonadmin=ALLOWED(check membership); ';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || 'nonadmin=' || SQLERRM || '; ';
  END;
  SELECT count(*) INTO v_cnt FROM clinic_role_permissions
  WHERE clinic_id NOT IN (SELECT user_clinic_ids());
  v_out := v_out || 'nonadmin_sees_foreign=' || v_cnt || '; ';
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'VERIFY_RESULT %', v_out;
END $$;
