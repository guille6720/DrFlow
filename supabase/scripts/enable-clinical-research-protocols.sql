-- Ejecutar en Supabase → SQL Editor si no podés correr migraciones.
-- Activa búsqueda de candidatos y catálogo de protocolos en Gemini para TODAS las clínicas.

INSERT INTO clinic_feature_flags (clinic_id, flag_id, enabled)
SELECT c.id, 'clinical_research_protocols', true
FROM clinics c
ON CONFLICT (clinic_id, flag_id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- Verificar:
-- SELECT clinic_id, flag_id, enabled FROM clinic_feature_flags WHERE flag_id = 'clinical_research_protocols';
