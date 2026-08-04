-- Phase G: admin/ops assistant feature flag seed.

INSERT INTO clinic_feature_flags (clinic_id, flag_id, enabled)
SELECT c.id, 'admin_ops_assistant', true
FROM clinics c
ON CONFLICT (clinic_id, flag_id) DO NOTHING;
