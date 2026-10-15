-- PROPOSAL (not applied anywhere). Least-privilege table grants for anon / authenticated in schema public.
-- Audit first with scripts/sql/AUDIT_ANON_AUTHENTICATED_PRIVILEGES.sql and keep the output.
-- Apply only after Batch 1 and Batch 2. Afterwards rollback/20260928155026_*.down.sql is superseded: it would
-- re-grant privileges this script removes.
--
-- Phase A — privileges no Data API endpoint can use (TRUNCATE, MAINTAIN, TRIGGER, REFERENCES).
--   TRUNCATE ignores RLS; MAINTAIN allows LOCK TABLE / VACUUM / REINDEX. No migration or application path uses them.
-- Phase B — anon INSERT / UPDATE / DELETE. Public routes (portal, verify) only SELECT or call SECURITY DEFINER RPCs,
--   and no anon-executable SECURITY INVOKER function writes tables.
-- Both phases also change the default privileges of role postgres so new tables do not get them back.
-- Default privileges owned by supabase_admin are platform-managed and need a separate decision.
--
-- Phase C (authenticated grants that RLS already denies) is NOT included: revoking them turns silent 0-row
-- UPDATE/DELETE into permission errors. Generate the list with the query at the end and review per table.

BEGIN;
SET LOCAL lock_timeout = '5s';

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

DO $$
BEGIN
  IF current_setting('server_version_num')::INT >= 170000 THEN
    EXECUTE 'REVOKE MAINTAIN ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE MAINTAIN ON TABLES FROM anon, authenticated';
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

DO $$
DECLARE
  v_left TEXT;
BEGIN
  SELECT string_agg(c.relname || ':' || a.privilege_type || ':' || r.rolname, ', ') INTO v_left
  FROM pg_class c
  CROSS JOIN LATERAL aclexplode(c.relacl) a
  JOIN pg_roles r ON r.oid = a.grantee
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
    AND (
      (r.rolname IN ('anon', 'authenticated') AND a.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN'))
      OR (r.rolname = 'anon' AND a.privilege_type IN ('INSERT', 'UPDATE', 'DELETE'))
    );
  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION 'LEAST_PRIVILEGE_VERIFY_FAILED: %', v_left;
  END IF;
END $$;

COMMIT;

-- Phase C candidate list (read-only; review each table before revoking):
-- SELECT format('REVOKE %s ON public.%I FROM authenticated;', a.privilege_type, c.relname)
-- FROM pg_class c
-- CROSS JOIN LATERAL aclexplode(c.relacl) a
-- WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND c.relrowsecurity
--   AND a.grantee = 'authenticated'::regrole AND a.privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
--   AND NOT EXISTS (
--     SELECT 1 FROM pg_policy p
--     WHERE p.polrelid = c.oid AND p.polpermissive
--       AND p.polcmd IN ('*', CASE a.privilege_type WHEN 'INSERT' THEN 'a' WHEN 'UPDATE' THEN 'w' ELSE 'd' END)
--       AND (0 = ANY (p.polroles) OR 'authenticated'::regrole = ANY (p.polroles)))
-- ORDER BY c.relname, a.privilege_type;
