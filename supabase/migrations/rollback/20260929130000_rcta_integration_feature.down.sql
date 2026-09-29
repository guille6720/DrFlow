-- Rollback of 20260929130000: removes only the RCTA feature definitions and their overrides.
DELETE FROM public.user_feature_settings WHERE feature_key IN ('rcta_integration', 'rcta_prescriptions', 'rcta_medical_orders');
DELETE FROM public.clinic_feature_settings WHERE feature_key IN ('rcta_integration', 'rcta_prescriptions', 'rcta_medical_orders');
DELETE FROM public.feature_definitions WHERE feature_key IN ('rcta_integration', 'rcta_prescriptions', 'rcta_medical_orders');
