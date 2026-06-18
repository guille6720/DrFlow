-- Módulo de referencia farmacológica: patologías (CIE-10) ↔ fármacos (ATC)
-- Relación Many-to-Many con líneas de tratamiento

CREATE TABLE IF NOT EXISTS pathologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cie10_code TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cie10_code)
);

CREATE TABLE IF NOT EXISTS drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active_ingredient TEXT NOT NULL,
  atc_code TEXT NOT NULL,
  atc_description TEXT,
  presentation TEXT,
  route TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (atc_code, name)
);

CREATE TABLE IF NOT EXISTS pathology_drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathology_id UUID NOT NULL REFERENCES pathologies(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  treatment_line SMALLINT NOT NULL DEFAULT 1 CHECK (treatment_line BETWEEN 1 AND 5),
  priority SMALLINT NOT NULL DEFAULT 1,
  indication_notes TEXT,
  dosage_reference TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pathology_id, drug_id, treatment_line)
);

CREATE INDEX IF NOT EXISTS idx_pathologies_name ON pathologies USING gin (to_tsvector('spanish', name));
CREATE INDEX IF NOT EXISTS idx_pathologies_cie10 ON pathologies(cie10_code);
CREATE INDEX IF NOT EXISTS idx_drugs_atc ON drugs(atc_code);
CREATE INDEX IF NOT EXISTS idx_pathology_drugs_pathology ON pathology_drugs(pathology_id, treatment_line, priority);

ALTER TABLE pathologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pathology_drugs ENABLE ROW LEVEL SECURITY;

-- Solo profesionales con acceso clínico pueden consultar referencia
CREATE POLICY pathologies_clinical_select ON pathologies FOR SELECT
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
    )
  );

CREATE POLICY drugs_clinical_select ON drugs FOR SELECT
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
    )
  );

CREATE POLICY pathology_drugs_clinical_select ON pathology_drugs FOR SELECT
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
    )
  );

-- ─── Seed: patologías CIE-10 ───
INSERT INTO pathologies (id, name, cie10_code, description) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'Hipertensión esencial (primaria)', 'I10', 'Presión arterial elevada sin causa identificable'),
  ('c1000000-0000-4000-8000-000000000002', 'Diabetes mellitus tipo 2', 'E11', 'Alteración del metabolismo de la glucosa'),
  ('c1000000-0000-4000-8000-000000000003', 'Asma', 'J45', 'Enfermedad inflamatoria crónica de vías aéreas'),
  ('c1000000-0000-4000-8000-000000000004', 'Depresión episódica', 'F32', 'Trastorno del estado de ánimo'),
  ('c1000000-0000-4000-8000-000000000005', 'Gastroesofagitis por reflujo', 'K21', 'ERGE — reflujo gastroesofágico'),
  ('c1000000-0000-4000-8000-000000000006', 'Infección del tracto urinario', 'N39.0', 'ITU sin localización especificada')
ON CONFLICT (cie10_code) DO NOTHING;

-- ─── Seed: fármacos ATC ───
INSERT INTO drugs (id, name, active_ingredient, atc_code, atc_description, presentation, route) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'Enalapril', 'Enalapril', 'C09AA02', 'IECA — inhibidores ECA', '10 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000002', 'Losartán', 'Losartán potásico', 'C09CA01', 'ARA II — antagonistas receptores angiotensina II', '50 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000003', 'Amlodipino', 'Amlodipino', 'C08CA01', 'Bloqueantes canales calcio dihidropiridínicos', '5 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000004', 'Metformina', 'Metformina', 'A10BA02', 'Biguanidas antidiabéticas', '850 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000005', 'Sitagliptina', 'Sitagliptina', 'A10BH01', 'Inhibidores DPP-4', '100 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000006', 'Insulina glargina', 'Insulina glargina', 'A10AE04', 'Insulinas de acción prolongada', '100 UI/ml', 'subcutánea'),
  ('d1000000-0000-4000-8000-000000000007', 'Salbutamol inhalador', 'Salbutamol', 'R03AC02', 'Agonistas beta-2 adrenérgicos de acción selectiva', '100 mcg/dosis', 'inhalatoria'),
  ('d1000000-0000-4000-8000-000000000008', 'Budesonida/formoterol', 'Budesonida + Formoterol', 'R03AK07', 'Corticoides inhalados + beta-2', '160/4.5 mcg', 'inhalatoria'),
  ('d1000000-0000-4000-8000-000000000009', 'Sertralina', 'Sertralina', 'N06AB06', 'ISRS — inhibidores recaptación serotonina', '50 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000010', 'Escitalopram', 'Escitalopram', 'N06AB10', 'ISRS', '10 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000011', 'Omeprazol', 'Omeprazol', 'A02BC01', 'Inhibidores bomba de protones', '20 mg cáps.', 'oral'),
  ('d1000000-0000-4000-8000-000000000012', 'Nitrofurantoína', 'Nitrofurantoína', 'J01XE01', 'Antibacterianos derivados nitrofurano', '100 mg comp.', 'oral'),
  ('d1000000-0000-4000-8000-000000000013', 'Fosfomicina trometamol', 'Fosfomicina', 'J01XX01', 'Antibacterianos — fosfomicina', '3 g sobres', 'oral'),
  ('d1000000-0000-4000-8000-000000000014', 'Hidroclorotiazida', 'Hidroclorotiazida', 'C03AA03', 'Diuréticos tiazídicos', '25 mg comp.', 'oral')
ON CONFLICT DO NOTHING;

-- ─── Seed: relaciones patología ↔ fármaco ───
INSERT INTO pathology_drugs (pathology_id, drug_id, treatment_line, priority, indication_notes, dosage_reference) VALUES
  -- Hipertensión I10
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 1, 1, 'Primera línea — IECA', '10–20 mg/día'),
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 1, 2, 'Primera línea — ARA II (alternativa)', '50 mg/día'),
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', 1, 3, 'Primera línea — calcioantagonista', '5 mg/día'),
  ('c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000014', 2, 1, 'Segunda línea — asociación diurético', '12.5–25 mg/día'),
  -- Diabetes E11
  ('c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000004', 1, 1, 'Primera línea — metformina', '500–2000 mg/día'),
  ('c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000005', 2, 1, 'Segunda línea — iDPP-4', '100 mg/día'),
  ('c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000006', 2, 2, 'Segunda/tercera línea — insulina basal', 'Según esquema'),
  -- Asma J45
  ('c1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000007', 1, 1, 'Rescate — SABA', 'Según necesidad'),
  ('c1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000008', 2, 1, 'Control — ICS/LABA', '1–2 inhal/día'),
  -- Depresión F32
  ('c1000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000009', 1, 1, 'Primera línea — ISRS', '50–200 mg/día'),
  ('c1000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000010', 1, 2, 'Primera línea — alternativa ISRS', '10–20 mg/día'),
  -- ERGE K21
  ('c1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000011', 1, 1, 'Primera línea — IBP', '20–40 mg/día'),
  -- ITU N39.0
  ('c1000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000012', 1, 1, 'Primera línea — cistitis no complicada', '100 mg c/12h x 5 días'),
  ('c1000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000013', 1, 2, 'Alternativa dosis única', '3 g dosis única')
ON CONFLICT DO NOTHING;

-- Búsqueda optimizada por nombre o CIE-10
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
    )
  ORDER BY
    CASE WHEN p.cie10_code ILIKE p_query || '%' THEN 0 ELSE 1 END,
    CASE WHEN p.name ILIKE p_query || '%' THEN 0 ELSE 1 END,
    p.name
  LIMIT LEAST(p_limit, 25);
$$;

GRANT EXECUTE ON FUNCTION search_pathologies(TEXT, INTEGER) TO authenticated;
