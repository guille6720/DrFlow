-- Habilita protocolos de investigación clínica para consultorios existentes.
-- El flag sigue default OFF en código para clínicas nuevas sin fila explícita;
-- esta migración activa el matching de candidatos y catálogo de protocolos en IA.

INSERT INTO clinic_feature_flags (clinic_id, flag_id, enabled)
SELECT c.id, 'clinical_research_protocols', true
FROM clinics c
ON CONFLICT (clinic_id, flag_id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = now();

COMMENT ON TABLE clinic_feature_flags IS
  'Feature flags granulares por clínica. clinical_research_protocols habilitado por migración 160.';
