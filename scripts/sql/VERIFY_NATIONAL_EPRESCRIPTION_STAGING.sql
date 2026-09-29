-- STAGING ONLY (gprmsufvhabntbrytwyi). Live verification of migrations 20260929120000 + 20260929121000.
-- Everything runs inside one DO block that ends with RAISE EXCEPTION, so ALL changes are rolled back.
-- Results are returned inside the exception message as JSON. Synthetic data only; no PHI is printed.
DO $$
DECLARE
  v_clinic uuid;
  v_patient uuid;
  v_prof uuid;
  v_user uuid;
  v_rx uuid;
  v_rx2 uuid;
  v_count int;
  v_visible int;
  v_outsider uuid;
  r jsonb := '{}'::jsonb;
BEGIN
  SELECT cm.clinic_id, cm.user_id INTO v_clinic, v_user
  FROM public.clinic_members cm
  JOIN public.professionals pr ON pr.clinic_id = cm.clinic_id
  JOIN public.patients pa ON pa.clinic_id = cm.clinic_id
  WHERE cm.role::text IN ('doctor', 'clinic_admin')
  LIMIT 1;
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'VERIFY_SETUP no clinic with member+professional+patient'; END IF;

  SELECT id INTO v_patient FROM public.patients WHERE clinic_id = v_clinic LIMIT 1;
  SELECT id INTO v_prof FROM public.professionals WHERE clinic_id = v_clinic LIMIT 1;

  -- Base rows created as the server (postgres) — issued, local only.
  INSERT INTO public.prescription_drafts (clinic_id, patient_id, professional_id, created_by, status, diagnosis_cie10, diagnosis_text, issued_at, disclaimer_accepted)
  VALUES (v_clinic, v_patient, v_prof, v_user, 'issued', 'Z00', 'VERIFY synthetic', now(), true)
  RETURNING id INTO v_rx;
  INSERT INTO public.prescription_drafts (clinic_id, patient_id, professional_id, created_by, status, diagnosis_cie10, diagnosis_text, issued_at, disclaimer_accepted)
  VALUES (v_clinic, v_patient, v_prof, v_user, 'issued', 'Z00', 'VERIFY synthetic 2', now(), true)
  RETURNING id INTO v_rx2;
  -- ===== As an authenticated clinic member (browser path) =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- T1: normal browser INSERT (no national columns) still works.
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.prescription_drafts (clinic_id, patient_id, professional_id, created_by, status, disclaimer_accepted)
    VALUES (v_clinic, v_patient, v_prof, v_user, 'draft', false);
    r := r || jsonb_build_object('T1_auth_insert_local_draft', 'ok');
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T1_auth_insert_local_draft', 'FAIL ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T2: browser INSERT with a CUIR is rejected.
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.prescription_drafts (clinic_id, patient_id, professional_id, created_by, status, disclaimer_accepted, cuir, repository_mode)
    VALUES (v_clinic, v_patient, v_prof, v_user, 'draft', false, '0001000202000112301', 'external');
    r := r || jsonb_build_object('T2_auth_insert_cuir', 'FAIL allowed');
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T2_auth_insert_cuir', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T3: browser UPDATE setting a CUIR is rejected.
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.prescription_drafts SET cuir = '0001000202000112301', repository_mode = 'external' WHERE id = v_rx;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    r := r || jsonb_build_object('T3_auth_update_cuir', CASE WHEN v_count = 0 THEN 'FAIL rls_hid_row' ELSE 'FAIL allowed' END);
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T3_auth_update_cuir', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T4: browser UPDATE of state / sandbox reference is rejected.
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.prescription_drafts SET national_rx_state = 'professional_validation_pending' WHERE id = v_rx;
    r := r || jsonb_build_object('T4_auth_update_state', 'FAIL allowed');
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T4_auth_update_state', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
  END;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.prescription_drafts SET sandbox_reference = 'SBX-RNPD-TEST', repository_mode = 'sandbox' WHERE id = v_rx;
    r := r || jsonb_build_object('T4b_auth_update_sandbox_ref', 'FAIL allowed');
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T4b_auth_update_sandbox_ref', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T5: browser UPDATE of a NON-national column on own clinic still works (trigger is transparent).
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.prescription_drafts SET notes = 'verify' WHERE id = v_rx;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    r := r || jsonb_build_object('T5_auth_update_notes', 'ok rows=' || v_count);
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T5_auth_update_notes', 'FAIL ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T6: cross-tenant — a non-superadmin user from ANOTHER clinic cannot see/update clinic A's prescription.
  SELECT cm.user_id INTO v_outsider
  FROM public.clinic_members cm
  JOIN public.profiles pf ON pf.id = cm.user_id
  WHERE COALESCE(pf.is_superadmin, false) = false
    AND NOT EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.user_id = cm.user_id AND m.clinic_id = v_clinic)
  LIMIT 1;
  v_outsider := COALESCE(v_outsider, gen_random_uuid());
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.prescription_drafts SET notes = 'x' WHERE id = v_rx;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    SELECT count(*) INTO v_visible FROM public.prescription_drafts WHERE id = v_rx;
    r := r || jsonb_build_object('T6_cross_tenant', 'updated=' || v_count || ' visible=' || v_visible);
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T6_cross_tenant', 'blocked ' || SQLSTATE);
  END;

  -- ===== As the server (service_role-equivalent) =====
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  -- T7: invalid transition issued_local -> cuir_assigned rejected.
  BEGIN
    UPDATE public.prescription_drafts SET national_rx_state = 'cuir_assigned', cuir = '0001000202000112301', repository_mode = 'external' WHERE id = v_rx;
    r := r || jsonb_build_object('T7_invalid_transition', 'FAIL allowed');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T7_invalid_transition', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T8: sandbox + CUIR rejected.
  BEGIN
    UPDATE public.prescription_drafts SET sandbox_reference = 'SBX-RNPD-TEST', repository_mode = 'sandbox', cuir = '0001000202000112301' WHERE id = v_rx;
    r := r || jsonb_build_object('T8_sandbox_with_cuir', 'FAIL allowed');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T8_sandbox_with_cuir', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T9: malformed CUIR rejected even for the server.
  BEGIN
    UPDATE public.prescription_drafts SET cuir = 'SBX-FAKE-CUIR', repository_mode = 'external' WHERE id = v_rx;
    r := r || jsonb_build_object('T9_malformed_cuir', 'FAIL allowed');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T9_malformed_cuir', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T10: full sandbox path is allowed and never carries a CUIR.
  BEGIN
    UPDATE public.prescription_drafts SET national_rx_state = 'professional_validation_pending', national_idempotency_key = 'nrx:verify:1', national_rx_updated_at = now() WHERE id = v_rx;
    UPDATE public.prescription_drafts SET national_rx_state = 'professional_validated', refeps_professional_status = 'validated', refeps_validation_mode = 'sandbox' WHERE id = v_rx;
    UPDATE public.prescription_drafts SET national_rx_state = 'repository_submission_pending', repository_provider = 'sandbox', repository_mode = 'sandbox' WHERE id = v_rx;
    UPDATE public.prescription_drafts SET national_rx_state = 'repository_submitted', sandbox_reference = 'SBX-RNPD-VERIFY0001', repository_status = 'registered' WHERE id = v_rx;
    r := r || jsonb_build_object('T10_sandbox_path', 'ok');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T10_sandbox_path', 'FAIL ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T11: sandbox row can never reach cuir_assigned.
  BEGIN
    UPDATE public.prescription_drafts SET national_rx_state = 'cuir_assigned' WHERE id = v_rx;
    r := r || jsonb_build_object('T11_sandbox_to_cuir_assigned', 'FAIL allowed');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T11_sandbox_to_cuir_assigned', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T12: sandbox_reference and idempotency key are immutable.
  BEGIN
    UPDATE public.prescription_drafts SET sandbox_reference = 'SBX-RNPD-OTHER0001' WHERE id = v_rx;
    r := r || jsonb_build_object('T12_sandbox_ref_immutable', 'FAIL allowed');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T12_sandbox_ref_immutable', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
  END;
  BEGIN
    UPDATE public.prescription_drafts SET national_idempotency_key = 'nrx:verify:changed' WHERE id = v_rx;
    r := r || jsonb_build_object('T12b_idempotency_immutable', 'FAIL allowed');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T12b_idempotency_immutable', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T13: duplicate idempotency key in the same clinic rejected.
  BEGIN
    UPDATE public.prescription_drafts SET national_rx_state = 'professional_validation_pending', national_idempotency_key = 'nrx:verify:1' WHERE id = v_rx2;
    r := r || jsonb_build_object('T13_duplicate_idempotency', 'FAIL allowed');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T13_duplicate_idempotency', 'blocked ' || SQLSTATE);
  END;

  -- T14: external path with an official-shaped CUIR is allowed; CUIR then immutable.
  BEGIN
    UPDATE public.prescription_drafts SET national_rx_state = 'professional_validation_pending', national_idempotency_key = 'nrx:verify:2' WHERE id = v_rx2;
    UPDATE public.prescription_drafts SET national_rx_state = 'professional_validated', refeps_professional_status = 'validated', refeps_validation_mode = 'official' WHERE id = v_rx2;
    UPDATE public.prescription_drafts SET national_rx_state = 'repository_submission_pending', repository_provider = 'verify-ext', repository_mode = 'external' WHERE id = v_rx2;
    UPDATE public.prescription_drafts SET national_rx_state = 'cuir_assigned', cuir = '0001000202000112301' WHERE id = v_rx2;
    r := r || jsonb_build_object('T14_external_cuir_assigned', 'ok');
    BEGIN
      UPDATE public.prescription_drafts SET cuir = '0001000202000112399' WHERE id = v_rx2;
      r := r || jsonb_build_object('T14b_cuir_immutable', 'FAIL allowed');
    EXCEPTION WHEN others THEN
      r := r || jsonb_build_object('T14b_cuir_immutable', 'blocked ' || SQLSTATE || ' ' || SQLERRM);
    END;
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('T14_external_cuir_assigned', 'FAIL ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- T15: privileges.
  r := r || jsonb_build_object(
    'T15_privs',
    jsonb_build_object(
      'auth_exec_server_writer', has_function_privilege('authenticated', 'public.national_rx_is_server_writer()', 'EXECUTE'),
      'anon_exec_server_writer', has_function_privilege('anon', 'public.national_rx_is_server_writer()', 'EXECUTE'),
      'auth_exec_transition', has_function_privilege('authenticated', 'public.national_rx_transition_allowed(text,text)', 'EXECUTE'),
      'auth_exec_guard', has_function_privilege('authenticated', 'public.guard_national_rx_columns()', 'EXECUTE'),
      'flag_default_enabled', (SELECT default_enabled FROM public.feature_definitions WHERE feature_key = 'national_electronic_prescription')
    )
  );

  RAISE EXCEPTION 'VERIFY_RESULTS %', r::text;
END $$;
