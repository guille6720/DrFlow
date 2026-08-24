-- ROLLBACK 133_tenant_isolation_public_api (PARTIAL — staging/local only).
-- Removes the shared tenant gate function. Does NOT restore prior api_* bodies.
-- To fully reverse: re-apply api_* definitions from git history before 133.
-- DO NOT run on production without an explicit ops runbook.

DROP FUNCTION IF EXISTS public.assert_public_api_clinic_access(UUID);

-- NOTE: api_* functions still contain PERFORM assert_public_api_clinic_access(...)
-- until replaced. After this DROP they will ERROR until re-migrated forward or restored.
COMMENT ON SCHEMA public IS
  '133 down is partial: restore api_* from pre-133 SQL before dropping the gate in live envs.';
