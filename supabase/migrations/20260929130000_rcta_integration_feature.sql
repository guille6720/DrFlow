-- RCTA external integration (phase 1: link only). Seed-only: registers the customization keys so
-- Superadmin can restrict them per clinic/user. No new tables, no clinic/user rows, no data changes.
-- Defaults mirror src/core/customizations/registry.ts. Customizations only restrict; RBAC/plan still apply.
-- Rollback: supabase/migrations/rollback/20260929130000_rcta_integration_feature.down.sql
DO $$
BEGIN
  IF to_regclass('public.feature_definitions') IS NOT NULL THEN
    INSERT INTO public.feature_definitions
      (feature_key, display_name, description, category, default_enabled, configurable_by_clinic, configurable_by_user, critical)
    VALUES
      ('rcta_integration', 'Integración RCTA', 'Acceso a RCTA (enlace externo) desde Recetas y Órdenes. No otorga permisos: requiere RBAC y plan.', 'compliance', true, true, true, false),
      ('rcta_prescriptions', 'RCTA — Recetas electrónicas', 'Botón Generar receta electrónica (RCTA). Requiere permiso de emitir recetas.', 'compliance', true, true, true, false),
      ('rcta_medical_orders', 'RCTA — Órdenes médicas', 'Botón Generar orden médica (RCTA). Requiere permiso de emitir órdenes médicas.', 'compliance', true, true, true, false)
    ON CONFLICT (feature_key) DO NOTHING;
  END IF;
END $$;
