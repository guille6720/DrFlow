-- STAGING ONLY (gprmsufvhabntbrytwyi). Live verification of medical orders v2.
-- Everything runs in one DO block that ends with RAISE EXCEPTION -> full rollback, no data persists.
DO $$
DECLARE
  c_clinic_a CONSTANT UUID := '4fff7b18-ca33-4198-975f-10cf399602b7';
  c_user_a   CONSTANT UUID := 'abcee25c-f727-4941-80b0-c343d1ae8c47';
  c_pro_a    CONSTANT UUID := '595408f2-f09b-456d-b19a-8fd1ccc5ff03';
  c_patient  CONSTANT UUID := '5169a854-26d2-461d-befd-a00109b8d8e2';
  c_user_b   CONSTANT UUID := '3deb6ffd-a0c0-45ac-9801-77f6a4191d67';
  v_foreign_patient UUID;
  v_other_pro UUID := gen_random_uuid();
  v_o1 UUID; v_o2 UUID; v_o3 UUID;
  v_row public.medical_orders;
  v_num2 TEXT;
  v_res JSONB := '{}'::jsonb;
  v_n INT;
  v_verify JSONB;
BEGIN
  SELECT id INTO v_foreign_patient FROM public.patients WHERE clinic_id <> c_clinic_a LIMIT 1;
  INSERT INTO public.professionals (id, clinic_id, display_name)
  VALUES (v_other_pro, c_clinic_a, 'Otro Profesional');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_user_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- 1. Draft creation + item
  INSERT INTO public.medical_orders (clinic_id, patient_id, professional_id, order_text, status, order_type, order_category, created_by, order_number)
  VALUES (c_clinic_a, c_patient, c_pro_a, 'Hemograma', 'draft', 'study', 'laboratorio', c_user_a, 'OM-FAKE')
  RETURNING * INTO v_row;
  v_o1 := v_row.id;
  v_res := v_res || jsonb_build_object('draft_number_forced_null', v_row.order_number IS NULL);
  INSERT INTO public.medical_order_items (clinic_id, medical_order_id, category, name)
  VALUES (c_clinic_a, v_o1, 'laboratorio', 'Hemograma completo');

  -- 2. Issue
  UPDATE public.medical_orders SET status = 'issued' WHERE id = v_o1 RETURNING * INTO v_row;
  v_res := v_res || jsonb_build_object(
    'issued_number', v_row.order_number,
    'token_ok', v_row.public_verification_token ~ '^[0-9a-f]{64}$',
    'hash_ok', v_row.document_hash IS NOT NULL,
    'issuer_snapshot_ok', v_row.issuer_snapshot ? 'mechanism',
    'patient_snapshot_ok', v_row.patient_snapshot IS NOT NULL);

  -- 3. Sequential numbering
  INSERT INTO public.medical_orders (clinic_id, patient_id, professional_id, order_text, status, order_type, order_category, created_by)
  VALUES (c_clinic_a, c_patient, c_pro_a, 'RX torax', 'issued', 'study', 'imagenes', c_user_a)
  RETURNING id, order_number INTO v_o2, v_num2;
  v_res := v_res || jsonb_build_object('second_number', v_num2);

  -- 4. Immutability
  BEGIN
    UPDATE public.medical_orders SET order_text = 'alterado' WHERE id = v_o1;
    v_res := v_res || '{"immutable_text":"FAIL"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('immutable_text', SQLERRM); END;
  BEGIN
    UPDATE public.medical_order_items SET name = 'alterado' WHERE medical_order_id = v_o1;
    v_res := v_res || '{"immutable_items":"FAIL"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('immutable_items', SQLERRM); END;
  BEGIN
    DELETE FROM public.medical_orders WHERE id = v_o1;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_res := v_res || jsonb_build_object('delete_issued', CASE WHEN v_n = 0 THEN 'blocked_by_rls' ELSE 'FAIL' END);
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('delete_issued', SQLERRM); END;

  -- 5. Verification (valid)
  v_verify := public.verify_medical_order(v_row.public_verification_token);
  v_res := v_res || jsonb_build_object(
    'verify_valid', v_verify->>'status',
    'verify_dni_masked', v_verify->>'patient_document_masked',
    'verify_hides_items', NOT (v_verify ? 'items') AND (v_verify->>'items_count')::int = 1,
    'verify_hides_full_name', v_verify::text NOT LIKE '%' || (SELECT last_name FROM public.patients WHERE id = c_patient) || '%');

  -- 6. Cancellation
  BEGIN
    UPDATE public.medical_orders SET status = 'void' WHERE id = v_o1;
    v_res := v_res || '{"void_no_reason":"FAIL"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('void_no_reason', SQLERRM); END;
  UPDATE public.medical_orders SET status = 'void', void_reason = 'Error de carga' WHERE id = v_o1 RETURNING * INTO v_row;
  v_res := v_res || jsonb_build_object('voided', v_row.status, 'voided_by_ok', v_row.voided_by = c_user_a, 'voided_at_ok', v_row.voided_at IS NOT NULL);
  BEGIN
    UPDATE public.medical_orders SET status = 'issued' WHERE id = v_o1;
    v_res := v_res || '{"unvoid":"FAIL"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('unvoid', SQLERRM); END;
  v_verify := public.verify_medical_order(v_row.public_verification_token);
  v_res := v_res || jsonb_build_object('verify_voided', v_verify->>'status');
  v_verify := public.verify_medical_order(repeat('0', 64));
  v_res := v_res || jsonb_build_object('verify_unknown_found', v_verify->>'found');
  v_verify := public.verify_medical_order('not-a-token');
  v_res := v_res || jsonb_build_object('verify_invalid_found', v_verify->>'found');

  -- 7. Anti-impersonation
  BEGIN
    INSERT INTO public.medical_orders (clinic_id, patient_id, professional_id, order_text, status, order_type, order_category, created_by)
    VALUES (c_clinic_a, c_patient, v_other_pro, 'x', 'issued', 'study', 'otra', c_user_a);
    v_res := v_res || '{"impersonation":"FAIL"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('impersonation', SQLERRM); END;

  -- 8. Patient linkage (patient from another clinic)
  IF v_foreign_patient IS NOT NULL THEN
    BEGIN
      INSERT INTO public.medical_orders (clinic_id, patient_id, professional_id, order_text, status, order_type, order_category, created_by)
      VALUES (c_clinic_a, v_foreign_patient, c_pro_a, 'x', 'issued', 'study', 'otra', c_user_a);
      v_res := v_res || '{"foreign_patient":"FAIL"}';
    EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('foreign_patient', SQLERRM); END;
  END IF;

  -- 9. Draft is editable, then deletable
  INSERT INTO public.medical_orders (clinic_id, patient_id, professional_id, order_text, status, order_type, order_category, created_by)
  VALUES (c_clinic_a, c_patient, c_pro_a, 'borrador', 'draft', 'study', 'kinesiologia', c_user_a) RETURNING id INTO v_o3;
  UPDATE public.medical_orders SET order_text = 'borrador editado' WHERE id = v_o3;
  DELETE FROM public.medical_orders WHERE id = v_o3;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_res := v_res || jsonb_build_object('draft_edit_delete', v_n = 1);

  -- 10. Tenant isolation: admin of clinic B
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_user_b, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_n FROM public.medical_orders WHERE id IN (v_o1, v_o2);
  v_res := v_res || jsonb_build_object('other_tenant_sees', v_n);
  SELECT count(*) INTO v_n FROM public.medical_order_items WHERE medical_order_id = v_o1;
  v_res := v_res || jsonb_build_object('other_tenant_sees_items', v_n);
  BEGIN
    INSERT INTO public.medical_orders (clinic_id, patient_id, professional_id, order_text, status, order_type, order_category, created_by)
    VALUES (c_clinic_a, c_patient, c_pro_a, 'x', 'draft', 'study', 'otra', c_user_b);
    v_res := v_res || '{"other_tenant_insert":"FAIL"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('other_tenant_insert', SQLERRM); END;
  BEGIN
    SELECT count(*) INTO v_n FROM public.medical_order_counters;
    v_res := v_res || jsonb_build_object('counters_visible', v_n);
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('counters_visible', 'denied'); END;
  BEGIN
    PERFORM public.next_medical_order_number(c_clinic_a);
    v_res := v_res || '{"next_number_rpc":"FAIL"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('next_number_rpc', 'denied'); END;

  -- 11. Secretary (no explicit grant) in clinic A
  EXECUTE 'RESET ROLE';
  INSERT INTO public.clinic_members (clinic_id, user_id, role, is_active)
  VALUES (c_clinic_a, c_user_b, 'secretary', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_user_b, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_n FROM public.medical_orders WHERE id IN (v_o1, v_o2);
  v_res := v_res || jsonb_build_object('secretary_sees', v_n);
  BEGIN
    INSERT INTO public.medical_orders (clinic_id, patient_id, professional_id, order_text, status, order_type, order_category, created_by)
    VALUES (c_clinic_a, c_patient, c_pro_a, 'x', 'issued', 'study', 'otra', c_user_b);
    v_res := v_res || '{"secretary_issue":"FAIL"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('secretary_issue', SQLERRM); END;

  RAISE EXCEPTION 'VERIFY_RESULT %', v_res::text;
END $$;
