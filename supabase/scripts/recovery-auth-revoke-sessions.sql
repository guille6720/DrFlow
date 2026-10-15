-- NexClinic Phase 0J — revoke every copied Supabase Auth session in the
-- RECOVERY project only (djhnxrlmmtbhwitqudrl).
--
-- NOT APPLIED. Requires explicit written authorization before execution.
--
-- Equivalent of GoTrue's global logout for every user: deletes auth.sessions
-- (refresh_tokens and mfa_amr_claims cascade on session_id) and any residual
-- refresh_tokens without a session. Users, identities, password hashes,
-- MFA factors, profiles, permissions and clinical rows are not touched.
--
-- Supabase Auth has no admin endpoint that revokes sessions by user id:
-- auth.admin.signOut() needs each user's own valid access token, and banning
-- does not delete sessions (lifting the ban revives the old refresh tokens).
--
-- Already-issued access tokens stay valid at the Data API / Storage until
-- their exp claim; only a signing-key rotation in the recovery project ends
-- them early.
--
-- Run in the recovery project's SQL editor (URL contains djhnxrlmmtbhwitqudrl)
-- after filling the SET LOCAL values below from the BEFORE run of
-- scripts/sql/RECOVERY_AUTH_ISOLATION_COUNTS.sql taken in that same editor.
--
-- The project ref cannot be read from inside Postgres, and a quiet production
-- database could match the expected counts with no auth activity after the
-- cutoff. expected_postmaster_start_utc pins this exact server instance
-- (check target_postmaster_start_utc); a restart in between makes the guard
-- refuse, and the BEFORE report must be taken again.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

SET LOCAL nexclinic.confirm_recovery_project_ref = '__REQUIRED__';
SET LOCAL nexclinic.expected_auth_users = '__REQUIRED__';
SET LOCAL nexclinic.expected_auth_sessions = '__REQUIRED__';
SET LOCAL nexclinic.expected_auth_refresh_tokens = '__REQUIRED__';
SET LOCAL nexclinic.recovery_snapshot_cutoff_utc = '__REQUIRED__';
SET LOCAL nexclinic.expected_postmaster_start_utc = '__REQUIRED__';

DO $guard$
DECLARE
  v_ref text := current_setting('nexclinic.confirm_recovery_project_ref', true);
  v_users text := current_setting('nexclinic.expected_auth_users', true);
  v_sessions text := current_setting('nexclinic.expected_auth_sessions', true);
  v_tokens text := current_setting('nexclinic.expected_auth_refresh_tokens', true);
  v_cutoff_txt text := current_setting('nexclinic.recovery_snapshot_cutoff_utc', true);
  v_pm_txt text := current_setting('nexclinic.expected_postmaster_start_utc', true);
  v_cutoff timestamp;
  v_latest timestamp;
BEGIN
  IF v_ref = 'nipqdarduknydqptqzup' THEN
    RAISE EXCEPTION 'RECOVERY_AUTH_REVOKE_PRODUCTION_REF_REFUSED';
  END IF;
  IF v_ref IS DISTINCT FROM 'djhnxrlmmtbhwitqudrl' THEN
    RAISE EXCEPTION 'RECOVERY_AUTH_REVOKE_TARGET_NOT_CONFIRMED';
  END IF;
  IF '__REQUIRED__' IN (v_users, v_sessions, v_tokens, v_cutoff_txt, v_pm_txt)
     OR v_users IS NULL OR v_sessions IS NULL OR v_tokens IS NULL OR v_cutoff_txt IS NULL OR v_pm_txt IS NULL THEN
    RAISE EXCEPTION 'RECOVERY_AUTH_REVOKE_EXPECTATIONS_MISSING';
  END IF;

  IF to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') IS DISTINCT FROM v_pm_txt THEN
    RAISE EXCEPTION 'RECOVERY_AUTH_REVOKE_SERVER_IDENTITY_MISMATCH'
      USING DETAIL = 'pg_postmaster_start_time() differs from the BEFORE report; re-run the report in the recovery project';
  END IF;

  IF (SELECT count(*) FROM auth.users) <> v_users::bigint
     OR (SELECT count(*) FROM auth.sessions) <> v_sessions::bigint
     OR (SELECT count(*) FROM auth.refresh_tokens) <> v_tokens::bigint THEN
    RAISE EXCEPTION 'RECOVERY_AUTH_REVOKE_UNEXPECTED_COUNTS'
      USING DETAIL = format('users=%s sessions=%s refresh_tokens=%s',
        (SELECT count(*) FROM auth.users),
        (SELECT count(*) FROM auth.sessions),
        (SELECT count(*) FROM auth.refresh_tokens));
  END IF;

  -- A live project (production) or a recovery project somebody already used
  -- shows auth activity after the snapshot cutoff.
  v_cutoff := v_cutoff_txt::timestamptz AT TIME ZONE 'UTC';
  SELECT max(ts) INTO v_latest FROM (
    SELECT max(coalesce(updated_at, created_at)) AS ts FROM auth.refresh_tokens
    UNION ALL SELECT max(coalesce(updated_at, created_at)) FROM auth.sessions
    UNION ALL SELECT max(created_at) AT TIME ZONE 'UTC' FROM auth.audit_log_entries
  ) s;
  IF v_latest > v_cutoff THEN
    RAISE EXCEPTION 'RECOVERY_AUTH_ACTIVITY_AFTER_SNAPSHOT'
      USING DETAIL = format('latest_auth_activity_utc=%s cutoff_utc=%s', v_latest, v_cutoff);
  END IF;
END
$guard$;

CREATE TEMP TABLE _recovery_auth_pre ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM auth.users) AS users,
  (SELECT count(*) FROM auth.identities) AS identities,
  (SELECT coalesce(md5(string_agg(md5(concat_ws('|', id, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, banned_until)), ',' ORDER BY id)), 'empty') FROM auth.users) AS users_digest,
  (SELECT coalesce(md5(string_agg(md5(concat_ws('|', id, user_id, provider, identity_data)), ',' ORDER BY id)), 'empty') FROM auth.identities) AS identities_digest,
  (SELECT coalesce(md5(string_agg(md5(f::text), ',' ORDER BY f.id)), 'empty') FROM auth.mfa_factors f) AS mfa_digest;

DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;

DO $verify$
DECLARE
  p record;
BEGIN
  SELECT * INTO p FROM _recovery_auth_pre;
  IF (SELECT count(*) FROM auth.sessions) <> 0
     OR (SELECT count(*) FROM auth.refresh_tokens) <> 0
     OR (SELECT count(*) FROM auth.mfa_amr_claims) <> 0
     OR (SELECT count(*) FROM auth.users) <> p.users
     OR (SELECT count(*) FROM auth.identities) <> p.identities
     OR (SELECT coalesce(md5(string_agg(md5(concat_ws('|', id, encrypted_password, email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, banned_until)), ',' ORDER BY id)), 'empty') FROM auth.users) <> p.users_digest
     OR (SELECT coalesce(md5(string_agg(md5(concat_ws('|', id, user_id, provider, identity_data)), ',' ORDER BY id)), 'empty') FROM auth.identities) <> p.identities_digest
     OR (SELECT coalesce(md5(string_agg(md5(f::text), ',' ORDER BY f.id)), 'empty') FROM auth.mfa_factors f) <> p.mfa_digest THEN
    RAISE EXCEPTION 'RECOVERY_AUTH_REVOKE_VERIFY_FAILED';
  END IF;
  RAISE NOTICE 'RECOVERY_AUTH_REVOKE_OK users=% identities=% sessions=0 refresh_tokens=0', p.users, p.identities;
END
$verify$;

COMMIT;
