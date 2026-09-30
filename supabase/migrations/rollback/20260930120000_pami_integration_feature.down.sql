-- Rollback of 20260930120000: removes only the PAMI feature definitions and their overrides.
DELETE FROM public.user_feature_settings WHERE feature_key IN ('pami_integration', 'pami_prescriptions', 'pami_medical_orders');
DELETE FROM public.clinic_feature_settings WHERE feature_key IN ('pami_integration', 'pami_prescriptions', 'pami_medical_orders');
DELETE FROM public.feature_definitions WHERE feature_key IN ('pami_integration', 'pami_prescriptions', 'pami_medical_orders');
