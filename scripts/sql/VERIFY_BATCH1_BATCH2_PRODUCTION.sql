-- READ-ONLY. Catalog/state report for Batch 1 (20260928120000, 20260929130000, 20260930120000) and
-- Batch 2 (20260928155026, 20260928203000, 20260928220000). Run before and after each batch; compare with
-- the expected values in docs/production-readiness/PHASE-0H-MIGRATION-SAFETY.md. Reads no patient data.
WITH fn(name) AS (
  VALUES ('assert_entitlement_superadmin'), ('is_superadmin'), ('user_clinic_ids'),
         ('user_role_in_clinic'), ('can_view_clinical'), ('can_write_clinical')
),
audit_cols(name) AS (
  VALUES ('clinic_id'), ('user_id'), ('patient_id'), ('entity_type'), ('entity_id'), ('action'),
         ('module'), ('what'), ('old_values'), ('new_values'), ('metadata')
)
SELECT 'server_version_num' AS check_name, current_setting('server_version_num') AS value
UNION ALL
SELECT 'prereq_function_' || fn.name,
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = fn.name)
            THEN 'present' ELSE 'MISSING' END
FROM fn
UNION ALL
SELECT 'audit_logs_missing_columns',
       COALESCE((SELECT string_agg(a.name, ',') FROM audit_cols a
                 WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                                   WHERE c.table_schema = 'public' AND c.table_name = 'audit_logs' AND c.column_name = a.name)), 'none')
UNION ALL
SELECT 'audit_action_has_create_update_delete',
       (SELECT (ARRAY['create', 'update', 'delete']::TEXT[] <@ array_agg(e.enumlabel::TEXT))::TEXT
        FROM pg_enum e WHERE e.enumtypid = 'public.audit_action'::regtype)
UNION ALL
SELECT 'audit_logs_triggers',
       COALESCE((SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger
                 WHERE tgrelid = 'public.audit_logs'::regclass AND NOT tgisinternal), 'none')
UNION ALL
SELECT 'table_' || t.name, CASE WHEN to_regclass('public.' || t.name) IS NULL THEN 'absent' ELSE 'present' END
FROM (VALUES ('feature_definitions'), ('clinic_feature_settings'), ('user_feature_settings'),
             ('clinic_role_permissions'), ('clinic_member_permissions'), ('clinic_products')) t(name)
UNION ALL
SELECT 'rls_enabled_' || c.relname, c.relrowsecurity::TEXT
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('feature_definitions', 'clinic_feature_settings', 'user_feature_settings', 'clinic_role_permissions', 'clinic_products')
UNION ALL
SELECT 'feature_definitions_keys',
       CASE WHEN to_regclass('public.feature_definitions') IS NULL THEN 'n/a'
            ELSE (xpath('//v/text()', query_to_xml(
                   'SELECT string_agg(feature_key, '','' ORDER BY feature_key) AS v FROM public.feature_definitions', false, false, '')))[1]::TEXT
       END
UNION ALL
SELECT 'clinic_products_acl',
       (SELECT array_to_string(ARRAY(SELECT a::TEXT FROM unnest(relacl) a ORDER BY 1), ' ')
        FROM pg_class WHERE oid = 'public.clinic_products'::regclass)
UNION ALL
SELECT 'clinic_products_policies',
       COALESCE((SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'clinic_products'), 'none')
UNION ALL
SELECT 'clinic_products_writers_security_definer',
       COALESCE((SELECT string_agg(proname || '=' || prosecdef, ',' ORDER BY proname) FROM pg_proc
                 WHERE pronamespace = 'public'::regnamespace
                   AND proname IN ('set_clinic_product', 'seed_clinic_products_on_clinic_insert', 'get_clinic_products')), 'none')
UNION ALL
SELECT 'clinic_role_permissions_key_check',
       COALESCE((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                 WHERE conname = 'clinic_role_permissions_permission_key_check'), 'none')
UNION ALL
SELECT 'new_secdef_functions_search_path',
       COALESCE((SELECT string_agg(p.proname || '=' || COALESCE(array_to_string(p.proconfig, ';'), 'NONE'), ',' ORDER BY p.proname)
                 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
                   AND p.proname IN ('get_feature_settings_snapshot', 'set_clinic_feature_setting', 'clear_clinic_feature_setting',
                                     'set_user_feature_setting', 'clear_user_feature_setting', 'set_clinic_role_permissions')), 'none')
UNION ALL
SELECT 'anon_execute_on_new_rpcs',
       COALESCE((SELECT string_agg(p.proname, ',' ORDER BY p.proname)
                 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                   AND p.proname IN ('get_feature_settings_snapshot', 'set_clinic_feature_setting', 'clear_clinic_feature_setting',
                                     'set_user_feature_setting', 'clear_user_feature_setting', 'set_clinic_role_permissions')
                   AND has_function_privilege('anon', p.oid, 'EXECUTE')), 'none')
UNION ALL
SELECT 'medical_orders_v2_installed',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'medical_orders' AND column_name = 'order_category')
            THEN 'yes' ELSE 'no' END
UNION ALL
SELECT 'recorded_versions_in_scope',
       CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN 'n/a'
            ELSE COALESCE((xpath('//v/text()', query_to_xml(
                   'SELECT string_agg(version, '','' ORDER BY version) AS v FROM supabase_migrations.schema_migrations
                    WHERE version IN (''20260928120000'', ''20260928155026'', ''20260928203000'', ''20260928220000'',
                                      ''20260929100000'', ''20260929110000'', ''20260929130000'', ''20260930120000'', ''20261014120000'')',
                   false, false, '')))[1]::TEXT, 'none')
       END;
