-- Phase 2: enable pg_stat_statements for staging query diagnostics.
-- Safe/idempotent: Supabase often pre-installs this in schema "extensions".
-- Does NOT change application behavior or RLS.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '156: pg_stat_statements requires dashboard enable on hosted Supabase';
  WHEN duplicate_object THEN
    NULL;
END $$;

COMMENT ON EXTENSION pg_stat_statements IS
  'Staging/production query performance diagnostics (Phase 2). Use scripts/staging-query-performance.mjs.';
