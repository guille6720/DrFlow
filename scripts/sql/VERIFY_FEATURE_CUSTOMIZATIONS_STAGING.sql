-- STAGING ONLY. Live verification of 20260928120000_feature_customizations (tenant isolation, RLS, audit).
-- Creates synthetic clinics/users and ALWAYS aborts with RAISE EXCEPTION, so nothing is persisted.
-- Run: npx supabase db query --linked -f scripts/sql/VERIFY_FEATURE_CUSTOMIZATIONS_STAGING.sql
DO $verify$
DECLARE
  c_a UUID := gen_random_uuid();
  c_b UUID := gen_random_uuid();
  u_admin_a UUID := gen_random_uuid();
  u_sec_a UUID := gen_random_uuid();
  u_b UUID := gen_random_uuid();
  u_sa UUID := gen_random_uuid();
  u UUID;
  r JSONB := '{}'::jsonb;
  v JSONB;
  n INT;
BEGIN
  IF current_database() IS NULL THEN RAISE EXCEPTION 'no db'; END IF;

  FOREACH u IN ARRAY ARRAY[u_admin_a, u_sec_a, u_b, u_sa] LOOP
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'fc-verify-' || left(u::text, 8) || '@example.invalid', '',
            '{}'::jsonb, '{"full_name":"FC Verify"}'::jsonb, now(), now());
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (u, 'fc-verify-' || left(u::text, 8) || '@example.invalid', 'FC Verify')
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
  UPDATE public.profiles SET is_superadmin = true WHERE id = u_sa;

  INSERT INTO public.clinics (id, name, slug) VALUES
    (c_a, 'FC Verify A', 'fc-verify-a-' || left(c_a::text, 8)),
    (c_b, 'FC Verify B', 'fc-verify-b-' || left(c_b::text, 8));
  INSERT INTO public.clinic_members (clinic_id, user_id, role) VALUES
    (c_a, u_admin_a, 'clinic_admin'),
    (c_a, u_sec_a, 'secretary'),
    (c_b, u_b, 'secretary');

  -- Superadmin: clinic A waiting_room OFF, user override ON for secretary A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_sa, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.set_clinic_feature_setting(c_a, 'waiting_room', false, NULL, 'verify', 'staging');
  PERFORM public.set_user_feature_setting(c_a, u_sec_a, 'waiting_room', true,
    '{"show_document_number":false}'::jsonb, 'verify', 'staging');
  BEGIN
    PERFORM public.set_user_feature_setting(c_a, u_b, 'waiting_room', false, NULL, 'verify', 'staging');
    r := r || '{"C4_user_from_other_clinic":"ALLOWED (BAD)"}';
  EXCEPTION WHEN OTHERS THEN
    r := r || jsonb_build_object('C4_user_from_other_clinic', SQLERRM);
  END;
  BEGIN
    PERFORM public.set_user_feature_setting(c_a, u_admin_a, 'unlimited_patients', false, NULL, 'verify', 'staging');
    r := r || '{"billing_user_override":"ALLOWED (BAD)"}';
  EXCEPTION WHEN OTHERS THEN
    r := r || jsonb_build_object('billing_user_override', SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- Test A: clinic admin A sees clinic OFF (no user rows of their own)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v := public.get_feature_settings_snapshot(c_a);
  r := r || jsonb_build_object('A_adminA_clinic_rows', v->'clinic', 'A_adminA_user_rows', v->'user');
  -- Test D: clinic admin cannot modify
  BEGIN
    PERFORM public.set_clinic_feature_setting(c_a, 'waiting_room', true, NULL, 'x', 'staging');
    r := r || '{"D1_admin_rpc_set":"ALLOWED (BAD)"}';
  EXCEPTION WHEN OTHERS THEN
    r := r || jsonb_build_object('D1_admin_rpc_set', SQLERRM);
  END;
  BEGIN
    UPDATE public.clinic_feature_settings SET enabled = true WHERE clinic_id = c_a;
    r := r || '{"D2_admin_direct_update":"ALLOWED (BAD)"}';
  EXCEPTION WHEN OTHERS THEN
    r := r || jsonb_build_object('D2_admin_direct_update', SQLERRM);
  END;
  BEGIN
    INSERT INTO public.clinic_feature_settings (clinic_id, feature_key, enabled) VALUES (c_b, 'waiting_room', false);
    r := r || '{"D3_admin_direct_insert":"ALLOWED (BAD)"}';
  EXCEPTION WHEN OTHERS THEN
    r := r || jsonb_build_object('D3_admin_direct_insert', SQLERRM);
  END;
  BEGIN
    DELETE FROM public.user_feature_settings WHERE clinic_id = c_a;
    r := r || '{"D4_admin_direct_delete":"ALLOWED (BAD)"}';
  EXCEPTION WHEN OTHERS THEN
    r := r || jsonb_build_object('D4_admin_direct_delete', SQLERRM);
  END;
  SELECT count(*) INTO n FROM public.clinic_feature_settings WHERE clinic_id = c_a;
  r := r || jsonb_build_object('D5_adminA_reads_own_clinic_rows', n);
  SELECT count(*) INTO n FROM public.user_feature_settings WHERE clinic_id = c_a;
  r := r || jsonb_build_object('D6_adminA_reads_own_clinic_user_rows', n);
  EXECUTE 'RESET ROLE';

  -- Test B: secretary A gets their own user override
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_sec_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v := public.get_feature_settings_snapshot(c_a);
  r := r || jsonb_build_object('B_secA_user_rows', v->'user');
  SELECT count(*) INTO n FROM public.clinic_feature_settings;
  r := r || jsonb_build_object('B_secA_direct_clinic_rows_visible', n);
  EXECUTE 'RESET ROLE';

  -- Test C: member of clinic B cannot read clinic A; B is unaffected by A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.get_feature_settings_snapshot(c_a);
    r := r || '{"C1_crosstenant_snapshot":"ALLOWED (BAD)"}';
  EXCEPTION WHEN OTHERS THEN
    r := r || jsonb_build_object('C1_crosstenant_snapshot', SQLERRM);
  END;
  SELECT count(*) INTO n FROM public.clinic_feature_settings WHERE clinic_id = c_a;
  r := r || jsonb_build_object('C2_userB_reads_clinicA_rows', n);
  SELECT count(*) INTO n FROM public.user_feature_settings WHERE clinic_id = c_a;
  r := r || jsonb_build_object('C3_userB_reads_clinicA_user_rows', n);
  v := public.get_feature_settings_snapshot(c_b);
  r := r || jsonb_build_object('G_clinicB_rows', v->'clinic', 'G_clinicB_user_rows', v->'user');
  EXECUTE 'RESET ROLE';

  -- anon has no access
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    SELECT count(*) INTO n FROM public.clinic_feature_settings;
    r := r || '{"anon_select":"ALLOWED (BAD)"}';
  EXCEPTION WHEN OTHERS THEN
    r := r || jsonb_build_object('anon_select', SQLERRM);
  END;
  BEGIN
    PERFORM public.get_feature_settings_snapshot(c_a);
    r := r || '{"anon_rpc":"ALLOWED (BAD)"}';
  EXCEPTION WHEN OTHERS THEN
    r := r || jsonb_build_object('anon_rpc', SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- Composite FK blocks a user row for a non-member even with elevated privileges
  BEGIN
    INSERT INTO public.user_feature_settings (clinic_id, user_id, feature_key, enabled) VALUES (c_a, u_b, 'waiting_room', true);
    r := r || '{"C5_fk_non_member":"ALLOWED (BAD)"}';
  EXCEPTION WHEN OTHERS THEN
    r := r || jsonb_build_object('C5_fk_non_member', SQLSTATE);
  END;

  -- Audit
  SELECT count(*) INTO n FROM public.audit_logs
  WHERE clinic_id = c_a AND entity_type IN ('clinic_feature_setting', 'user_feature_setting');
  r := r || jsonb_build_object('audit_rows', n);
  SELECT jsonb_agg(jsonb_build_object(
           'entity', entity_type, 'action', action, 'actor_is_sa', user_id = u_sa,
           'old', old_values, 'new', new_values,
           'feature', metadata->>'feature_key', 'target_is_secA', (metadata->>'target_user_id')::uuid = u_sec_a,
           'env', metadata->>'environment'))
  INTO v FROM public.audit_logs
  WHERE clinic_id = c_a AND entity_type IN ('clinic_feature_setting', 'user_feature_setting');
  r := r || jsonb_build_object('audit', v);

  RAISE EXCEPTION 'VERIFY_RESULT %', r::text;
END
$verify$;
