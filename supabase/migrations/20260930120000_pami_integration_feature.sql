-- PAMI external integration (phase 1: link to official PAMI pages only). Seed-only: registers the
-- customization keys so Superadmin can restrict them per clinic/user. No new tables, no clinic/user rows,
-- no data changes, no credential storage. Defaults mirror src/core/customizations/registry.ts.
-- Customizations only restrict; RBAC/plan still apply.
-- Rollback: supabase/migrations/rollback/20260930120000_pami_integration_feature.down.sql
DO $$
BEGIN
  IF to_regclass('public.feature_definitions') IS NOT NULL THEN
    INSERT INTO public.feature_definitions
      (feature_key, display_name, description, category, default_enabled, configurable_by_clinic, configurable_by_user, critical)
    VALUES
      ('pami_integration', 'Integración PAMI', 'Acceso a los sistemas oficiales de PAMI (enlace externo) desde Recetas y Órdenes. No otorga permisos: requiere RBAC y plan.', 'compliance', true, true, true, false),
      ('pami_prescriptions', 'PAMI — Receta electrónica', 'Botón Receta PAMI. Requiere permiso de emitir recetas.', 'compliance', true, true, true, false),
      ('pami_medical_orders', 'PAMI — Orden médica electrónica (OME)', 'Botón Orden PAMI / OME. Requiere permiso de emitir órdenes médicas.', 'compliance', true, true, true, false)
    ON CONFLICT (feature_key) DO NOTHING;
  END IF;
END $$;
