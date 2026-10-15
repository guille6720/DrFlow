-- NexClinic Phase 0J — recovery project auth isolation: counts and digests only.
--
-- Read-only. Single SELECT. Run BEFORE and AFTER session revocation on the
-- recovery project (djhnxrlmmtbhwitqudrl) only. Never run against production
-- (nipqdarduknydqptqzup) as part of this procedure.
--
-- Output: one row per check_name. Values are counts, timestamps, role names,
-- provider names or md5 digests. No emails, phones, names, tokens, password
-- hashes or clinical values are returned. Digests are aggregate md5 values
-- used only to prove that rows are unchanged between the two runs.
--
-- Missing objects report 'absent' instead of failing.

SELECT v.ord, v.check_name,
  CASE
    WHEN v.req IS NOT NULL AND to_regclass(v.req) IS NULL THEN 'absent'
    ELSE coalesce((xpath('//v/text()', query_to_xml(v.q, false, true, '')))[1]::text, 'null')
  END AS value
FROM (VALUES
  -- A. Target fingerprint (compare with the recovery snapshot cutoff)
  (101, 'target_database', NULL, $q$select current_database() as v$q$),
  (102, 'target_server_version_num', NULL, $q$select current_setting('server_version_num') as v$q$),
  (103, 'target_postmaster_start_utc', NULL, $q$select to_char(pg_postmaster_start_time() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as v$q$),
  (104, 'auth_latest_refresh_token_activity_utc', 'auth.refresh_tokens', $q$select coalesce(to_char(max(coalesce(updated_at, created_at)), 'YYYY-MM-DD"T"HH24:MI:SS'), 'none') as v from auth.refresh_tokens$q$),
  (105, 'auth_latest_session_activity_utc', 'auth.sessions', $q$select coalesce(to_char(max(coalesce(updated_at, created_at)), 'YYYY-MM-DD"T"HH24:MI:SS'), 'none') as v from auth.sessions$q$),
  (106, 'auth_latest_audit_event_utc', 'auth.audit_log_entries', $q$select coalesce(to_char(max(created_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'none') as v from auth.audit_log_entries$q$),
  (107, 'auth_audit_actions_since_db_start', 'auth.audit_log_entries', $q$select coalesce(string_agg(a || '=' || n, ',' order by a), 'none') as v from (select coalesce(payload->>'action', '?') a, count(*) n from auth.audit_log_entries where created_at > pg_postmaster_start_time() group by 1) s$q$),

  -- B. Auth state
  (201, 'auth_users_total', 'auth.users', $q$select count(*) as v from auth.users$q$),
  (202, 'auth_users_soft_deleted', 'auth.users', $q$select count(*) as v from auth.users u where to_jsonb(u)->>'deleted_at' is not null$q$),
  (203, 'auth_users_banned_now', 'auth.users', $q$select count(*) as v from auth.users u where (to_jsonb(u)->>'banned_until')::timestamptz > now()$q$),
  (204, 'auth_users_with_password', 'auth.users', $q$select count(*) as v from auth.users u where coalesce(to_jsonb(u)->>'encrypted_password', '') <> ''$q$),
  (205, 'auth_users_anonymous', 'auth.users', $q$select count(*) as v from auth.users u where (to_jsonb(u)->>'is_anonymous')::boolean$q$),
  (206, 'auth_users_sso', 'auth.users', $q$select count(*) as v from auth.users u where (to_jsonb(u)->>'is_sso_user')::boolean$q$),
  (207, 'auth_users_with_pending_link_tokens', 'auth.users', $q$select count(*) as v from auth.users u, lateral (select to_jsonb(u) j) x where coalesce(j->>'confirmation_token', '') <> '' or coalesce(j->>'recovery_token', '') <> '' or coalesce(j->>'email_change_token_new', '') <> '' or coalesce(j->>'email_change_token_current', '') <> '' or coalesce(j->>'phone_change_token', '') <> '' or coalesce(j->>'reauthentication_token', '') <> ''$q$),
  (208, 'auth_identities_by_provider', 'auth.identities', $q$select coalesce(string_agg(provider || '=' || n, ',' order by provider), 'none') as v from (select provider, count(*) n from auth.identities group by 1) s$q$),
  (209, 'auth_sessions_total', 'auth.sessions', $q$select count(*) as v from auth.sessions$q$),
  (210, 'auth_sessions_distinct_users', 'auth.sessions', $q$select count(distinct user_id) as v from auth.sessions$q$),
  (211, 'auth_refresh_tokens_total', 'auth.refresh_tokens', $q$select count(*) as v from auth.refresh_tokens$q$),
  (212, 'auth_refresh_tokens_not_revoked', 'auth.refresh_tokens', $q$select count(*) as v from auth.refresh_tokens where not coalesce(revoked, false)$q$),
  (213, 'auth_refresh_tokens_without_session', 'auth.refresh_tokens', $q$select count(*) as v from auth.refresh_tokens r where to_jsonb(r)->>'session_id' is null$q$),
  (214, 'auth_mfa_factors_by_type_status', 'auth.mfa_factors', $q$select coalesce(string_agg(k || '=' || n, ',' order by k), 'none') as v from (select factor_type::text || '/' || status::text k, count(*) n from auth.mfa_factors group by 1) s$q$),
  (215, 'auth_mfa_challenges_total', 'auth.mfa_challenges', $q$select count(*) as v from auth.mfa_challenges$q$),
  (216, 'auth_mfa_amr_claims_total', 'auth.mfa_amr_claims', $q$select count(*) as v from auth.mfa_amr_claims$q$),
  (217, 'auth_one_time_tokens_total', 'auth.one_time_tokens', $q$select count(*) as v from auth.one_time_tokens$q$),
  (218, 'auth_flow_state_total', 'auth.flow_state', $q$select count(*) as v from auth.flow_state$q$),
  (219, 'auth_sso_providers_total', 'auth.sso_providers', $q$select count(*) as v from auth.sso_providers$q$),
  (220, 'auth_saml_providers_total', 'auth.saml_providers', $q$select count(*) as v from auth.saml_providers$q$),
  (221, 'auth_oauth_clients_total', 'auth.oauth_clients', $q$select count(*) as v from auth.oauth_clients$q$),

  -- C. Preservation digests (must be identical before and after)
  (301, 'auth_users_digest', 'auth.users', $q$select coalesce(md5(string_agg(md5(concat_ws('|', j->>'id', j->>'encrypted_password', j->>'email_confirmed_at', j->>'phone_confirmed_at', j->'raw_app_meta_data', j->'raw_user_meta_data')), ',' order by j->>'id')), 'empty') as v from auth.users u, lateral (select to_jsonb(u) j) x$q$),
  (302, 'auth_identities_digest', 'auth.identities', $q$select coalesce(md5(string_agg(md5(concat_ws('|', j->>'id', j->>'user_id', j->>'provider', j->'identity_data')), ',' order by j->>'id')), 'empty') as v from auth.identities i, lateral (select to_jsonb(i) j) x$q$),
  (303, 'auth_mfa_factors_digest', 'auth.mfa_factors', $q$select coalesce(md5(string_agg(md5(f::text), ',' order by f.id)), 'empty') as v from auth.mfa_factors f$q$),
  (304, 'public_rowcount_profiles', 'public.profiles', $q$select count(*) as v from public.profiles$q$),
  (305, 'public_rowcount_clinic_members', 'public.clinic_members', $q$select count(*) as v from public.clinic_members$q$),
  (306, 'public_rowcount_clinic_member_permissions', 'public.clinic_member_permissions', $q$select count(*) as v from public.clinic_member_permissions$q$),
  (307, 'public_rowcount_patients', 'public.patients', $q$select count(*) as v from public.patients$q$),
  (308, 'public_rowcount_clinical_records', 'public.clinical_records', $q$select count(*) as v from public.clinical_records$q$),
  (309, 'public_rowcount_medical_orders', 'public.medical_orders', $q$select count(*) as v from public.medical_orders$q$),
  (310, 'public_rowcount_appointments', 'public.appointments', $q$select count(*) as v from public.appointments$q$),
  (311, 'public_rowcount_audit_logs', 'public.audit_logs', $q$select count(*) as v from public.audit_logs$q$),
  (312, 'public_tables_total', NULL, $q$select count(*) as v from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')$q$),
  (313, 'public_schema_data_digest', NULL, $q$select coalesce(md5(string_agg(t.relname || ':' || x.d, ',' order by t.relname)), 'empty') as v from pg_class t join pg_namespace n on n.oid = t.relnamespace cross join lateral (select (xpath('//d/text()', query_to_xml(format('select count(*)::text || '':'' || coalesce(md5(string_agg(md5(r::text), '''' order by md5(r::text))), ''-'') as d from %I.%I r', n.nspname, t.relname), false, true, '')))[1]::text as d) x where n.nspname = 'public' and t.relkind in ('r', 'p')$q$),

  -- D. Residual access surfaces not covered by Supabase Auth session revocation
  (401, 'app_patient_portal_sessions_active', 'public.patient_portal_sessions', $q$select count(*) as v from public.patient_portal_sessions where revoked_at is null and expires_at > now()$q$),
  (402, 'app_clinic_api_keys_active', 'public.clinic_api_keys', $q$select count(*) as v from public.clinic_api_keys where is_active and revoked_at is null and (expires_at is null or expires_at > now())$q$),
  (403, 'app_user_device_sessions_active', 'public.user_device_sessions', $q$select count(*) as v from public.user_device_sessions where revoked_at is null$q$),
  (404, 'app_user_ai_connections_with_key', 'public.user_ai_connections', $q$select count(*) as v from public.user_ai_connections where coalesce(api_key, '') <> ''$q$),
  (405, 'app_clinic_shared_ai_connections_with_key', 'public.clinic_shared_ai_connections', $q$select count(*) as v from public.clinic_shared_ai_connections where coalesce(api_key, '') <> ''$q$),
  (406, 'vault_secrets_total', 'vault.secrets', $q$select count(*) as v from vault.secrets$q$),
  (407, 'cron_jobs_active', 'cron.job', $q$select count(*) as v from cron.job where active$q$),
  (408, 'net_http_request_queue', 'net.http_request_queue', $q$select count(*) as v from net.http_request_queue$q$),
  (409, 'db_webhook_hooks_total', 'supabase_functions.hooks', $q$select count(*) as v from supabase_functions.hooks$q$),
  (410, 'foreign_servers_total', NULL, $q$select count(*) as v from pg_foreign_server$q$),
  (411, 'user_mappings_total', NULL, $q$select count(*) as v from pg_user_mappings$q$),
  (412, 'non_platform_login_roles', NULL, $q$select coalesce(string_agg(rolname, ',' order by rolname), 'none') as v from pg_roles where rolcanlogin and rolname not like 'pg\_%' and rolname not in ('postgres', 'supabase_admin', 'authenticator', 'supabase_auth_admin', 'supabase_storage_admin', 'supabase_functions_admin', 'supabase_replication_admin', 'supabase_read_only_user', 'supabase_realtime_admin', 'supabase_etl_admin', 'pgbouncer', 'dashboard_user', 'cli_login_postgres', 'pgsodium_keyholder', 'supabase_privileged_role')$q$),
  (413, 'publications', NULL, $q$select coalesce(string_agg(pubname, ',' order by pubname), 'none') as v from pg_publication$q$),
  (414, 'subscriptions_total', NULL, $q$select count(*) as v from pg_stat_subscription$q$),
  (415, 'replication_slots', NULL, $q$select coalesce(string_agg(slot_name || '/' || slot_type, ',' order by slot_name), 'none') as v from pg_replication_slots$q$)
) AS v(ord, check_name, req, q)
ORDER BY v.ord;
