-- Síntomas ↔ patologías + búsqueda por presentación clínica
-- Ejecutar después de 005/005b

CREATE TABLE IF NOT EXISTS symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS pathology_symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathology_id UUID NOT NULL REFERENCES pathologies(id) ON DELETE CASCADE,
  symptom_id UUID NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
  relevance SMALLINT NOT NULL DEFAULT 2 CHECK (relevance BETWEEN 1 AND 3),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pathology_id, symptom_id)
);

CREATE INDEX IF NOT EXISTS idx_symptoms_name ON symptoms USING gin (to_tsvector('spanish', name));
CREATE INDEX IF NOT EXISTS idx_symptoms_aliases ON symptoms USING gin (aliases);
CREATE INDEX IF NOT EXISTS idx_pathology_symptoms_pathology ON pathology_symptoms(pathology_id);
CREATE INDEX IF NOT EXISTS idx_pathology_symptoms_symptom ON pathology_symptoms(symptom_id);

ALTER TABLE symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE pathology_symptoms ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY symptoms_clinical_select ON symptoms FOR SELECT
    USING (
      is_superadmin()
      OR EXISTS (
        SELECT 1 FROM clinic_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.is_active = true
          AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY pathology_symptoms_clinical_select ON pathology_symptoms FOR SELECT
    USING (
      is_superadmin()
      OR EXISTS (
        SELECT 1 FROM clinic_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.is_active = true
          AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Patologías adicionales
INSERT INTO pathologies (id, name, cie10_code, description) VALUES
  ('c1000000-0000-4000-8000-000000000007', 'Migraña', 'G43', 'Cefalea primaria recurrente, a menudo unilateral y pulsátil'),
  ('c1000000-0000-4000-8000-000000000008', 'Lumbalgia', 'M54.5', 'Dolor en región lumbar sin irradiación especificada'),
  ('c1000000-0000-4000-8000-000000000009', 'Trastorno de ansiedad generalizada', 'F41.1', 'Ansiedad persistente con preocupación excesiva'),
  ('c1000000-0000-4000-8000-000000000010', 'Rinitis alérgica', 'J30.4', 'Rinitis alérgica no especificada')
ON CONFLICT (cie10_code) DO NOTHING;

INSERT INTO drugs (id, name, active_ingredient, atc_code, atc_description, presentation, route) VALUES
  ('d1000000-0000-4000-8000-000000000015', 'Sumatriptán', 'Sumatriptán', 'N02CC01', 'Agonistas selectivos receptores 5-HT1', '50 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000016', 'Ibuprofeno', 'Ibuprofeno', 'M01AE01', 'Antiinflamatorios no esteroideos', '600 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000017', 'Paracetamol', 'Paracetamol', 'N02BE01', 'Anilidas — analgésicos no narcóticos', '1 g comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000018', 'Diclofenac', 'Diclofenac potásico', 'M01AB05', 'Antiinflamatorios no esteroideos', '50 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000019', 'Lorazepam', 'Lorazepam', 'N05BA06', 'Benzodiazepinas — ansiolíticos', '1 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000020', 'Cetirizina', 'Cetirizina', 'R06AE07', 'Antihistamínicos H1', '10 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000021', 'Fluticasona nasal', 'Fluticasona', 'R01AD08', 'Corticoides nasales', '50 mcg/dosis', 'nasal')
ON CONFLICT DO NOTHING;

INSERT INTO pathology_drugs (pathology_id, drug_id, treatment_line, priority, indication_notes, dosage_reference) VALUES
  ('c1000000-0000-4000-8000-000000000007', 'd1000000-0000-4000-8000-000000000015', 1, 1, 'Primera línea — crisis aguda', '50–100 mg al inicio'),
  ('c1000000-0000-4000-8000-000000000007', 'd1000000-0000-4000-8000-000000000016', 1, 2, 'Alternativa AINE', '600 mg al inicio'),
  ('c1000000-0000-4000-8000-000000000008', 'd1000000-0000-4000-8000-000000000017', 1, 1, 'Analgesia de primera línea', '1 g c/8h'),
  ('c1000000-0000-4000-8000-000000000008', 'd1000000-0000-4000-8000-000000000018', 1, 2, 'AINE si no hay contraindicación', '50 mg c/8–12h'),
  ('c1000000-0000-4000-8000-000000000009', 'd1000000-0000-4000-8000-000000000009', 1, 1, 'Primera línea — ISRS', '50 mg/día'),
  ('c1000000-0000-4000-8000-000000000009', 'd1000000-0000-4000-8000-000000000019', 2, 1, 'Corto plazo — crisis (con precaución)', '0.5–1 mg c/8h'),
  ('c1000000-0000-4000-8000-000000000010', 'd1000000-0000-4000-8000-000000000020', 1, 1, 'Antihistamínico oral', '10 mg/día'),
  ('c1000000-0000-4000-8000-000000000010', 'd1000000-0000-4000-8000-000000000021', 1, 2, 'Corticoide nasal', '2 pulverizaciones/narina/día')
ON CONFLICT DO NOTHING;

-- Síntomas (presentación clínica)
INSERT INTO symptoms (id, name, category, description, aliases) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'Cefalea', 'Neurológico', 'Dolor de cabeza', ARRAY['dolor de cabeza', 'headache']),
  ('f1000000-0000-4000-8000-000000000002', 'Mareos', 'Neurológico', 'Sensación de inestabilidad o vértigo leve', ARRAY['vértigo', 'lightheaded']),
  ('f1000000-0000-4000-8000-000000000003', 'Visión borrosa', 'Oftalmológico', 'Disminución agudeza visual transitoria', ARRAY['visión nublada']),
  ('f1000000-0000-4000-8000-000000000004', 'Poliuria', 'Metabólico', 'Aumento del volumen urinario', ARRAY['orina abundante', 'muchas ganas de orinar cantidad']),
  ('f1000000-0000-4000-8000-000000000005', 'Polidipsia', 'Metabólico', 'Aumento de la sed', ARRAY['muchas ganas de tomar agua', 'sed intensa']),
  ('f1000000-0000-4000-8000-000000000006', 'Fatiga', 'General', 'Cansancio persistente', ARRAY['astenia', 'debilidad']),
  ('f1000000-0000-4000-8000-000000000007', 'Disnea', 'Respiratorio', 'Dificultad para respirar', ARRAY['falta de aire', 'ahogo']),
  ('f1000000-0000-4000-8000-000000000008', 'Sibilancias', 'Respiratorio', 'Silbidos al respirar', ARRAY['silbidos', 'wheezing']),
  ('f1000000-0000-4000-8000-000000000009', 'Tos', 'Respiratorio', 'Tos seca o productiva', ARRAY['tos seca', 'tos nocturna']),
  ('f1000000-0000-4000-8000-000000000010', 'Opresión torácica', 'Respiratorio', 'Sensación de peso en el pecho', ARRAY['pecho apretado']),
  ('f1000000-0000-4000-8000-000000000011', 'Ánimo bajo', 'Psiquiátrico', 'Estado de ánimo disminuido', ARRAY['tristeza', 'depresión', 'desánimo']),
  ('f1000000-0000-4000-8000-000000000012', 'Anhedonia', 'Psiquiátrico', 'Pérdida de interés o placer', ARRAY['sin ganas de nada']),
  ('f1000000-0000-4000-8000-000000000013', 'Insomnio', 'Psiquiátrico', 'Dificultad para conciliar o mantener el sueño', ARRAY['no puedo dormir']),
  ('f1000000-0000-4000-8000-000000000014', 'Pirosis', 'Digestivo', 'Ardor retroesternal', ARRAY['acidez', 'ardor estómago', 'reflujo']),
  ('f1000000-0000-4000-8000-000000000015', 'Regurgitación', 'Digestivo', 'Retorno de contenido gástrico', ARRAY['regurgito', 'sabor ácido']),
  ('f1000000-0000-4000-8000-000000000016', 'Dolor epigástrico', 'Digestivo', 'Dolor en boca del estómago', ARRAY['dolor estómago']),
  ('f1000000-0000-4000-8000-000000000017', 'Disuria', 'Urológico', 'Dolor al orinar', ARRAY['arde al orinar', 'dolor al orinar']),
  ('f1000000-0000-4000-8000-000000000018', 'Polaquiuria', 'Urológico', 'Aumento de frecuencia miccional', ARRAY['orinar seguido', 'muchas idas al baño']),
  ('f1000000-0000-4000-8000-000000000019', 'Urgencia miccional', 'Urológico', 'Necesidad imperiosa de orinar', ARRAY['no aguanto las ganas']),
  ('f1000000-0000-4000-8000-000000000020', 'Dolor lumbar', 'Musculoesquelético', 'Dolor en zona baja de espalda', ARRAY['lumbalgia', 'dolor espalda baja']),
  ('f1000000-0000-4000-8000-000000000021', 'Ansiedad', 'Psiquiátrico', 'Nerviosismo o preocupación excesiva', ARRAY['nervios', 'angustia', 'inquietud']),
  ('f1000000-0000-4000-8000-000000000022', 'Rinorrea', 'ORL', 'Secreción nasal', ARRAY['moco nasal', 'goteo nasal']),
  ('f1000000-0000-4000-8000-000000000023', 'Estornudos', 'ORL', 'Estornudos frecuentes', ARRAY['estornudo']),
  ('f1000000-0000-4000-8000-000000000024', 'Prurito nasal', 'ORL', 'Picazón en nariz', ARRAY['picazón nariz', 'comezón nasal']),
  ('f1000000-0000-4000-8000-000000000025', 'Náuseas', 'Digestivo', 'Sensación de malestar gástrico con ganas de vomitar', ARRAY['ganas de vomitar']),
  ('f1000000-0000-4000-8000-000000000026', 'Fotofobia', 'Neurológico', 'Intolerancia a la luz', ARRAY['molestia con la luz']),
  ('f1000000-0000-4000-8000-000000000027', 'Polifagia', 'Metabólico', 'Aumento del apetito', ARRAY['mucho hambre', 'come mucho']),
  ('f1000000-0000-4000-8000-000000000028', 'Dolor suprapúbico', 'Urológico', 'Dolor sobre pubis', ARRAY['dolor vejiga'])
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  aliases = EXCLUDED.aliases;

-- Relación síntoma ↔ patología (relevance: 3=muy sugestivo, 2=común, 1=asociado)
INSERT INTO pathology_symptoms (pathology_id, symptom_id, relevance) VALUES
  -- Hipertensión I10
  ('c1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 2),
  ('c1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 2),
  ('c1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000003', 2),
  -- Diabetes E11
  ('c1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000004', 3),
  ('c1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000005', 3),
  ('c1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000027', 2),
  ('c1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003', 2),
  ('c1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000006', 2),
  -- Asma J45
  ('c1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000007', 3),
  ('c1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000008', 3),
  ('c1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000009', 2),
  ('c1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000010', 2),
  -- Depresión F32
  ('c1000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000011', 3),
  ('c1000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000012', 3),
  ('c1000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000013', 2),
  ('c1000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000006', 2),
  -- ERGE K21
  ('c1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000014', 3),
  ('c1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000015', 3),
  ('c1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000016', 2),
  ('c1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000009', 1),
  -- ITU N39.0
  ('c1000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000017', 3),
  ('c1000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000018', 3),
  ('c1000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000019', 2),
  ('c1000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000028', 2),
  -- Migraña G43
  ('c1000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000001', 3),
  ('c1000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000026', 3),
  ('c1000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000025', 2),
  -- Lumbalgia M54.5
  ('c1000000-0000-4000-8000-000000000008', 'f1000000-0000-4000-8000-000000000020', 3),
  -- Ansiedad F41.1
  ('c1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-000000000021', 3),
  ('c1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-000000000013', 2),
  ('c1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-000000000006', 2),
  -- Rinitis J30.4
  ('c1000000-0000-4000-8000-000000000010', 'f1000000-0000-4000-8000-000000000022', 3),
  ('c1000000-0000-4000-8000-000000000010', 'f1000000-0000-4000-8000-000000000023', 2),
  ('c1000000-0000-4000-8000-000000000010', 'f1000000-0000-4000-8000-000000000024', 2)
ON CONFLICT (pathology_id, symptom_id) DO UPDATE SET relevance = EXCLUDED.relevance;

-- Búsqueda de síntomas por nombre o alias
CREATE OR REPLACE FUNCTION search_symptoms(p_query TEXT, p_limit INTEGER DEFAULT 12)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  description TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.category, s.description
  FROM symptoms s
  WHERE s.is_active = true
    AND (
      s.name ILIKE '%' || p_query || '%'
      OR s.description ILIKE '%' || p_query || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(s.aliases) alias
        WHERE alias ILIKE '%' || p_query || '%'
      )
    )
  ORDER BY
    CASE WHEN s.name ILIKE p_query || '%' THEN 0 ELSE 1 END,
    s.name
  LIMIT LEAST(p_limit, 25);
$$;

-- Patologías sugeridas según síntomas seleccionados
CREATE OR REPLACE FUNCTION search_pathologies_by_symptoms(
  p_symptom_ids UUID[],
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cie10_code TEXT,
  description TEXT,
  match_count INTEGER,
  relevance_score INTEGER,
  matched_symptoms TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.cie10_code,
    p.description,
    COUNT(DISTINCT ps.symptom_id)::INTEGER AS match_count,
    SUM(ps.relevance)::INTEGER AS relevance_score,
    ARRAY_AGG(DISTINCT s.name ORDER BY s.name) AS matched_symptoms
  FROM pathologies p
  JOIN pathology_symptoms ps ON ps.pathology_id = p.id AND ps.is_active = true
  JOIN symptoms s ON s.id = ps.symptom_id
  WHERE p.is_active = true
    AND ps.symptom_id = ANY(p_symptom_ids)
  GROUP BY p.id, p.name, p.cie10_code, p.description
  ORDER BY relevance_score DESC, match_count DESC, p.name
  LIMIT LEAST(p_limit, 25);
$$;

-- Ampliar búsqueda de patologías: incluye descripción
CREATE OR REPLACE FUNCTION search_pathologies(p_query TEXT, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cie10_code TEXT,
  description TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.cie10_code, p.description
  FROM pathologies p
  WHERE p.is_active = true
    AND (
      p.cie10_code ILIKE p_query || '%'
      OR p.name ILIKE '%' || p_query || '%'
      OR p.cie10_code ILIKE '%' || p_query || '%'
      OR p.description ILIKE '%' || p_query || '%'
    )
  ORDER BY
    CASE WHEN p.cie10_code ILIKE p_query || '%' THEN 0 ELSE 1 END,
    CASE WHEN p.name ILIKE p_query || '%' THEN 0 ELSE 1 END,
    p.name
  LIMIT LEAST(p_limit, 25);
$$;

GRANT EXECUTE ON FUNCTION search_symptoms(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_pathologies_by_symptoms(UUID[], INTEGER) TO authenticated;
