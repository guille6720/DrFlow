-- Rollback for 20260928120000_feature_customizations.sql
-- Safe: the app falls back to code defaults (current behavior) when these objects are missing.
-- audit_logs rows written by the RPCs are immutable and intentionally kept.

DROP FUNCTION IF EXISTS public.clear_user_feature_setting(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.set_user_feature_setting(UUID, UUID, TEXT, BOOLEAN, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.clear_clinic_feature_setting(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.set_clinic_feature_setting(UUID, TEXT, BOOLEAN, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_feature_settings_snapshot(UUID);
DROP FUNCTION IF EXISTS public.assert_feature_config_shape(JSONB);
DROP FUNCTION IF EXISTS public.normalize_feature_environment(TEXT);

DROP TABLE IF EXISTS public.user_feature_settings;
DROP TABLE IF EXISTS public.clinic_feature_settings;
DROP TABLE IF EXISTS public.feature_definitions;

NOTIFY pgrst, 'reload schema';
