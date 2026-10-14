-- Reverts 20260928155026_hardening_clinic_products_grants.sql by restoring the exact pre-change privileges.
--
-- Documented pre-change state (Supabase default privileges; migration 158 itself only granted SELECT):
--   anon          = SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER (+ MAINTAIN on PostgreSQL 17+), no grant option
--   authenticated = same as anon
--   service_role and the owner are not touched by the forward migration and are not touched here.
-- Capture the live ACL before applying the forward migration (scripts/sql/VERIFY_BATCH1_BATCH2_PRODUCTION.sql);
-- if it differs from the state above, update this file before using it.
--
-- SECURITY: this re-opens the exposure the forward migration closed. TRUNCATE is not subject to RLS, and
-- INSERT/UPDATE/DELETE fall back to RLS alone (clinic_products has no write policies, so DML stays denied).
-- Use only if the hardening itself causes a verified outage; clinic_products writes go through
-- SECURITY DEFINER functions (set_clinic_product, seed_clinic_products_on_clinic_insert) and do not need these grants.

DO $$
DECLARE
  v_anon TEXT[];
  v_auth TEXT[];
BEGIN
  SELECT array_agg(privilege_type ORDER BY privilege_type) INTO v_anon
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'clinic_products' AND grantee = 'anon';
  SELECT array_agg(privilege_type ORDER BY privilege_type) INTO v_auth
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'clinic_products' AND grantee = 'authenticated';
  IF v_anon IS NOT NULL OR v_auth IS DISTINCT FROM ARRAY['SELECT'] THEN
    RAISE EXCEPTION 'CLINIC_PRODUCTS_ROLLBACK_UNEXPECTED_STATE: anon=% authenticated=% (expected anon=none, authenticated={SELECT})',
      v_anon, v_auth;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.clinic_products TO anon, authenticated;

DO $$
BEGIN
  IF current_setting('server_version_num')::INT >= 170000 THEN
    EXECUTE 'GRANT MAINTAIN ON TABLE public.clinic_products TO anon, authenticated';
  END IF;
END $$;

DO $$
DECLARE
  v_expected TEXT := CASE WHEN current_setting('server_version_num')::INT >= 170000 THEN 'arwdDxtm' ELSE 'arwdDxt' END;
  v_acl TEXT[];
BEGIN
  SELECT array_agg(a::TEXT ORDER BY a::TEXT) INTO v_acl
  FROM pg_class c, unnest(c.relacl) a
  WHERE c.oid = 'public.clinic_products'::regclass
    AND (a::TEXT LIKE 'anon=%' OR a::TEXT LIKE 'authenticated=%');
  IF v_acl IS DISTINCT FROM ARRAY[
    'anon=' || v_expected || '/' || (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.clinic_products'::regclass),
    'authenticated=' || v_expected || '/' || (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.clinic_products'::regclass)
  ] THEN
    RAISE EXCEPTION 'CLINIC_PRODUCTS_ROLLBACK_VERIFY_FAILED: %', v_acl;
  END IF;
END $$;
