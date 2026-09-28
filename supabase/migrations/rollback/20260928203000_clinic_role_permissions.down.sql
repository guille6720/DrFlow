-- Rollback for 20260928203000_clinic_role_permissions.sql
-- Safe: the app ignores the role layer when the table is missing (code defaults + member overrides).
DROP FUNCTION IF EXISTS public.set_clinic_role_permissions(UUID, TEXT, JSONB);
DROP TABLE IF EXISTS public.clinic_role_permissions;

NOTIFY pgrst, 'reload schema';
