-- Síntomas frecuentes en consulta + búsqueda por palabras (lenguaje coloquial)
-- Ej: "dolor en las piernas" -> Dolor en piernas

INSERT INTO pathologies (id, name, cie10_code, description) VALUES
  ('c1000000-0000-4000-8000-000000000011', 'Faringitis aguda', 'J02.9', 'Inflamación aguda de faringe, frecuente en consulta ambulatoria'),
  ('c1000000-0000-4000-8000-000000000012', 'Gastroenteritis infecciosa', 'A09', 'Diarrea y/o vómitos de probable origen infeccioso')
ON CONFLICT (cie10_code) DO NOTHING;

INSERT INTO pathology_drugs (pathology_id, drug_id, treatment_line, priority, indication_notes, dosage_reference) VALUES
  ('c1000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000016', 1, 1, 'Analgesia / antiinflamatorio', '600 mg c/8h'),
  ('c1000000-0000-4000-8000-000000000011', 'd1000000-0000-4000-8000-000000000017', 1, 2, 'Alternativa analgésica', '1 g c/8h'),
  ('c1000000-0000-4000-8000-000000000012', 'd1000000-0000-4000-8000-000000000017', 1, 1, 'Síntomas y rehidratación oral', '1 g c/8h'),
  ('c1000000-0000-4000-8000-000000000012', 'd1000000-0000-4000-8000-000000000011', 2, 1, 'Si náuseas/reflujo asociado', '20 mg/día')
ON CONFLICT DO NOTHING;

INSERT INTO symptoms (id, name, category, description, aliases) VALUES
  ('f1000000-0000-4000-8000-000000000029', 'Dolor en piernas', 'Musculoesquelético', 'Dolor o molestia en miembros inferiores', ARRAY['dolor en las piernas', 'dolor de piernas', 'dolor pierna', 'piernas adoloridas', 'me duelen las piernas']),
  ('f1000000-0000-4000-8000-000000000030', 'Dolor de garganta', 'ORL', 'Odinofagia o molestia faríngea', ARRAY['dolor garganta', 'garganta adolorida', 'me duele la garganta', 'ardor garganta']),
  ('f1000000-0000-4000-8000-000000000031', 'Dolor abdominal', 'Digestivo', 'Dolor en abdomen o flancos', ARRAY['dolor de panza', 'dolor de estómago', 'dolor en la panza', 'dolor abdominal difuso']),
  ('f1000000-0000-4000-8000-000000000032', 'Fiebre', 'General', 'Elevación de temperatura corporal', ARRAY['temperatura alta', 'febrícula', 'tengo fiebre', 'fiebre alta']),
  ('f1000000-0000-4000-8000-000000000033', 'Congestión nasal', 'ORL', 'Obstrucción nasal', ARRAY['nariz tapada', 'no puedo respirar por la nariz', 'congestión', 'tapado de nariz']),
  ('f1000000-0000-4000-8000-000000000034', 'Dolor de oído', 'ORL', 'Otalgia', ARRAY['dolor oído', 'me duele el oído', 'otalgia']),
  ('f1000000-0000-4000-8000-000000000035', 'Vómitos', 'Digestivo', 'Episodios eméticos', ARRAY['vomitar', 'náuseas y vómitos', 'vómito']),
  ('f1000000-0000-4000-8000-000000000036', 'Diarrea', 'Digestivo', 'Deposiciones líquidas frecuentes', ARRAY['deposiciones líquidas', 'cólicos y diarrea', 'diarrea acuosa']),
  ('f1000000-0000-4000-8000-000000000037', 'Estreñimiento', 'Digestivo', 'Disminución de frecuencia evacuatoria', ARRAY['no puedo ir al baño', 'costipado', 'deposiciones duras']),
  ('f1000000-0000-4000-8000-000000000038', 'Palpitaciones', 'Cardiovascular', 'Percepción de latidos cardíacos', ARRAY['corazón acelerado', 'taquicardia', 'siento el corazón']),
  ('f1000000-0000-4000-8000-000000000039', 'Dolor articular', 'Musculoesquelético', 'Artralgia en una o más articulaciones', ARRAY['dolor en las articulaciones', 'dolor rodillas', 'dolor en las rodillas', 'dolor hombro']),
  ('f1000000-0000-4000-8000-000000000040', 'Edema en piernas', 'Cardiovascular', 'Hinchazón de miembros inferiores', ARRAY['piernas hinchadas', 'hinchazón piernas', 'hinchazón tobillos', 'piernas inflamadas']),
  ('f1000000-0000-4000-8000-000000000041', 'Prurito', 'Dermatológico', 'Picazón en piel', ARRAY['picazón', 'comezón', 'me pica la piel']),
  ('f1000000-0000-4000-8000-000000000042', 'Erupción cutánea', 'Dermatológico', 'Lesiones en piel', ARRAY['sarpullido', 'manchas en la piel', 'ronchas', 'rash']),
  ('f1000000-0000-4000-8000-000000000043', 'Dolor torácico', 'Cardiovascular', 'Dolor u opresión en el pecho', ARRAY['dolor en el pecho', 'dolor pecho', 'opresión pecho']),
  ('f1000000-0000-4000-8000-000000000044', 'Tos productiva', 'Respiratorio', 'Tos con expectoración', ARRAY['tos con flema', 'tos con moco', 'expectoración']),
  ('f1000000-0000-4000-8000-000000000045', 'Malestar general', 'General', 'Sensación de enfermedad inespecífica', ARRAY['decaimiento', 'mal estar', 'cuerpo cortado']),
  ('f1000000-0000-4000-8000-000000000046', 'Calambres musculares', 'Musculoesquelético', 'Contracturas o calambres', ARRAY['calambres', 'contractura', 'calambre en la pierna'])
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  aliases = EXCLUDED.aliases;

INSERT INTO pathology_symptoms (pathology_id, symptom_id, relevance) VALUES
  -- Dolor piernas
  ('c1000000-0000-4000-8000-000000000008', 'f1000000-0000-4000-8000-000000000029', 3),
  ('c1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000029', 2),
  ('c1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000029', 2),
  ('c1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000040', 2),
  ('c1000000-0000-4000-8000-000000000008', 'f1000000-0000-4000-8000-000000000046', 2),
  -- Dolor garganta
  ('c1000000-0000-4000-8000-000000000011', 'f1000000-0000-4000-8000-000000000030', 3),
  ('c1000000-0000-4000-8000-000000000011', 'f1000000-0000-4000-8000-000000000032', 2),
  -- Dolor abdominal / GI
  ('c1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000031', 2),
  ('c1000000-0000-4000-8000-000000000012', 'f1000000-0000-4000-8000-000000000031', 2),
  ('c1000000-0000-4000-8000-000000000012', 'f1000000-0000-4000-8000-000000000035', 3),
  ('c1000000-0000-4000-8000-000000000012', 'f1000000-0000-4000-8000-000000000036', 3),
  ('c1000000-0000-4000-8000-000000000012', 'f1000000-0000-4000-8000-000000000032', 2),
  -- Rinitis / ORL
  ('c1000000-0000-4000-8000-000000000010', 'f1000000-0000-4000-8000-000000000033', 3),
  ('c1000000-0000-4000-8000-000000000010', 'f1000000-0000-4000-8000-000000000034', 1),
  -- Asma / respiratorio
  ('c1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000044', 2),
  ('c1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000043', 2),
  ('c1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000043', 2),
  ('c1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000038', 2),
  -- Articular / lumbalgia
  ('c1000000-0000-4000-8000-000000000008', 'f1000000-0000-4000-8000-000000000039', 2),
  -- Depresión / ansiedad
  ('c1000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000045', 2),
  ('c1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-000000000045', 2),
  ('c1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-000000000038', 1)
ON CONFLICT (pathology_id, symptom_id) DO UPDATE SET relevance = EXCLUDED.relevance;

-- Búsqueda mejorada: frase completa + palabras sueltas (ignora artículos/preposiciones)
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
  WITH q AS (
    SELECT lower(trim(p_query)) AS text
  ),
  words AS (
    SELECT array_agg(w) AS list
    FROM (
      SELECT w
      FROM q, unnest(regexp_split_to_array(q.text, '\s+')) AS w
      WHERE length(w) >= 3
        AND w NOT IN (
          'con', 'sin', 'por', 'para', 'las', 'los', 'una', 'uno', 'del', 'que',
          'muy', 'mas', 'más', 'the', 'and', 'con', 'sus', 'mis', 'tus'
        )
    ) t
  ),
  scored AS (
    SELECT
      s.id,
      s.name,
      s.category,
      s.description,
      (
        CASE WHEN s.name ILIKE (SELECT text FROM q) || '%' THEN 100 ELSE 0 END
        + CASE WHEN s.name ILIKE '%' || (SELECT text FROM q) || '%' THEN 80 ELSE 0 END
        + CASE WHEN EXISTS (
          SELECT 1 FROM unnest(s.aliases) a
          WHERE a ILIKE '%' || (SELECT text FROM q) || '%'
        ) THEN 90 ELSE 0 END
        + CASE WHEN s.description ILIKE '%' || (SELECT text FROM q) || '%' THEN 40 ELSE 0 END
        + COALESCE((
          SELECT COUNT(*)::INTEGER * 25
          FROM unnest(COALESCE((SELECT list FROM words), ARRAY[]::TEXT[])) AS word
          WHERE lower(s.name) LIKE '%' || word || '%'
             OR lower(coalesce(s.description, '')) LIKE '%' || word || '%'
             OR EXISTS (
               SELECT 1 FROM unnest(s.aliases) a
               WHERE lower(a) LIKE '%' || word || '%'
             )
        ), 0)
      ) AS score
    FROM symptoms s
    WHERE s.is_active = true
  )
  SELECT id, name, category, description
  FROM scored
  WHERE score > 0
  ORDER BY score DESC, name
  LIMIT LEAST(p_limit, 25);
$$;

GRANT EXECUTE ON FUNCTION search_symptoms(TEXT, INTEGER) TO authenticated;
