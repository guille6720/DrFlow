-- Independent clinical treatments catalog (plan terapéutico / conductas).
-- NOT linked to diagnoses. Medications stay in the medication catalog / vademecum.
-- Additive: does not rewrite historical clinical_records.indications TEXT.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS clinical_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT,
  kind TEXT NOT NULL
    CHECK (kind IN ('pharmacologic', 'non_pharmacologic', 'conduct')),
  category TEXT NOT NULL,
  synonyms TEXT[] NOT NULL DEFAULT '{}'::text[],
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinical_treatments_name_nonempty CHECK (trim(name) <> '')
);

COMMENT ON TABLE clinical_treatments IS
  'Catálogo independiente de tratamientos/conductas (no medicamentos). El médico elige manualmente; no se vincula a diagnósticos.';

CREATE OR REPLACE FUNCTION public.clinical_treatments_set_normalized()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_name := public.immutable_unaccent(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_treatments_normalized ON clinical_treatments;
CREATE TRIGGER trg_clinical_treatments_normalized
  BEFORE INSERT OR UPDATE OF name ON clinical_treatments
  FOR EACH ROW
  EXECUTE FUNCTION public.clinical_treatments_set_normalized();

CREATE INDEX IF NOT EXISTS idx_clinical_treatments_active_kind
  ON clinical_treatments (active, kind, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_clinical_treatments_normalized_trgm
  ON clinical_treatments USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clinical_treatments_name_trgm
  ON clinical_treatments USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clinical_treatments_synonyms_gin
  ON clinical_treatments USING gin (synonyms);

ALTER TABLE clinical_treatments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_treatments_select ON clinical_treatments;
CREATE POLICY clinical_treatments_select ON clinical_treatments FOR SELECT
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
    )
  );

DROP POLICY IF EXISTS clinical_treatments_insert ON clinical_treatments;
DROP POLICY IF EXISTS clinical_treatments_update ON clinical_treatments;
CREATE POLICY clinical_treatments_insert ON clinical_treatments FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role = 'clinic_admin'
    )
  );
CREATE POLICY clinical_treatments_update ON clinical_treatments FOR UPDATE
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role = 'clinic_admin'
    )
  );

ALTER TABLE clinical_record_treatments
  ADD COLUMN IF NOT EXISTS clinical_treatment_id UUID REFERENCES clinical_treatments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS treatment_kind TEXT
    CHECK (
      treatment_kind IS NULL
      OR treatment_kind IN ('pharmacologic', 'non_pharmacologic', 'conduct', 'medication', 'free_text')
    ),
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_crt_clinical_treatment_id
  ON clinical_record_treatments (clinical_treatment_id)
  WHERE clinical_treatment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crt_treatment_kind
  ON clinical_record_treatments (clinic_id, treatment_kind)
  WHERE treatment_kind IS NOT NULL;

CREATE OR REPLACE FUNCTION public.search_clinical_treatments(
  p_query TEXT,
  p_limit INTEGER DEFAULT 12,
  p_kind TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  normalized_name TEXT,
  kind TEXT,
  category TEXT,
  synonyms TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q TEXT := public.immutable_unaccent(trim(coalesce(p_query, '')));
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 12), 30));
  v_kind TEXT := NULLIF(trim(COALESCE(p_kind, '')), '');
BEGIN
  IF auth.uid() IS NULL AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF length(v_q) < 2 THEN
    RETURN;
  END IF;

  IF v_kind IS NOT NULL AND v_kind NOT IN ('pharmacologic', 'non_pharmacologic', 'conduct') THEN
    RAISE EXCEPTION 'INVALID_KIND';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.normalized_name,
    t.kind,
    t.category,
    t.synonyms
  FROM clinical_treatments t
  WHERE t.active = true
    AND (v_kind IS NULL OR t.kind = v_kind)
    AND (
      t.normalized_name LIKE '%' || v_q || '%'
      OR public.immutable_unaccent(t.name) LIKE '%' || v_q || '%'
      OR public.immutable_unaccent(t.category) LIKE '%' || v_q || '%'
      OR EXISTS (
        SELECT 1
        FROM unnest(t.synonyms) AS syn(s)
        WHERE public.immutable_unaccent(syn.s) LIKE '%' || v_q || '%'
      )
    )
  ORDER BY
    CASE
      WHEN t.normalized_name LIKE v_q || '%' THEN 0
      WHEN EXISTS (
        SELECT 1 FROM unnest(t.synonyms) AS syn(s)
        WHERE public.immutable_unaccent(syn.s) LIKE v_q || '%'
      ) THEN 1
      ELSE 2
    END,
    t.sort_order,
    t.category,
    t.name
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_clinical_treatments(TEXT, INTEGER, TEXT) TO authenticated;

-- Refresh child sync to persist treatment catalog ids/kinds (keeps TEXT dual-write).
CREATE OR REPLACE FUNCTION public.sync_clinical_record_children(
  p_clinical_record_id UUID,
  p_clinic_id UUID,
  p_patient_id UUID,
  p_diagnoses_json JSONB,
  p_treatments_json JSONB,
  p_actor UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diag JSONB;
  v_tx JSONB;
  v_idx INTEGER := 0;
  v_name TEXT;
  v_cie10 TEXT;
  v_cie11 TEXT;
  v_snomed TEXT;
  v_pathology_id UUID;
  v_catalog_id UUID;
  v_is_chronic BOOLEAN;
  v_diag_id UUID;
  v_product TEXT;
  v_treatment_id UUID;
  v_treatment_kind TEXT;
  v_category TEXT;
BEGIN
  DELETE FROM clinical_record_diagnoses
  WHERE clinical_record_id = p_clinical_record_id
    AND clinic_id = p_clinic_id;

  DELETE FROM clinical_record_treatments
  WHERE clinical_record_id = p_clinical_record_id
    AND clinic_id = p_clinic_id;

  IF jsonb_typeof(COALESCE(p_diagnoses_json, '[]'::jsonb)) = 'array' THEN
    FOR v_diag IN SELECT value FROM jsonb_array_elements(COALESCE(p_diagnoses_json, '[]'::jsonb))
    LOOP
      v_name := NULLIF(trim(COALESCE(v_diag->>'name', '')), '');
      IF v_name IS NULL THEN
        CONTINUE;
      END IF;

      v_cie10 := NULLIF(trim(COALESCE(v_diag->>'cie10_code', '')), '');
      v_cie11 := NULLIF(trim(COALESCE(v_diag->>'cie11_code', '')), '');
      v_snomed := NULLIF(trim(COALESCE(v_diag->>'snomed_code', '')), '');
      BEGIN
        v_pathology_id := NULLIF(trim(COALESCE(v_diag->>'pathology_id', '')), '')::uuid;
      EXCEPTION WHEN others THEN
        v_pathology_id := NULL;
      END;
      BEGIN
        v_catalog_id := NULLIF(
          trim(COALESCE(v_diag->>'clinical_diagnosis_id', v_diag->>'catalog_id', '')),
          ''
        )::uuid;
      EXCEPTION WHEN others THEN
        v_catalog_id := NULL;
      END;
      v_is_chronic := COALESCE((v_diag->>'is_chronic')::boolean, false);

      INSERT INTO clinical_record_diagnoses (
        clinic_id, patient_id, clinical_record_id,
        name, cie10_code, pathology_id, is_chronic, sort_order, created_by,
        clinical_diagnosis_id, snomed_code, cie11_code
      )
      VALUES (
        p_clinic_id, p_patient_id, p_clinical_record_id,
        v_name, v_cie10, v_pathology_id, v_is_chronic, v_idx, p_actor,
        v_catalog_id, v_snomed, v_cie11
      )
      RETURNING id INTO v_diag_id;

      IF v_is_chronic THEN
        IF v_cie10 IS NOT NULL THEN
          UPDATE patient_problem_list
          SET
            name = v_name,
            pathology_id = COALESCE(v_pathology_id, pathology_id),
            status = 'active',
            source_clinical_record_id = p_clinical_record_id,
            source_diagnosis_id = v_diag_id,
            resolved_at = NULL,
            updated_at = now()
          WHERE clinic_id = p_clinic_id
            AND patient_id = p_patient_id
            AND cie10_code = v_cie10;

          IF NOT FOUND THEN
            INSERT INTO patient_problem_list (
              clinic_id, patient_id, name, cie10_code, pathology_id, status,
              source_clinical_record_id, source_diagnosis_id, created_by
            )
            VALUES (
              p_clinic_id, p_patient_id, v_name, v_cie10, v_pathology_id, 'active',
              p_clinical_record_id, v_diag_id, p_actor
            );
          END IF;
        ELSE
          UPDATE patient_problem_list
          SET
            status = 'active',
            pathology_id = COALESCE(v_pathology_id, pathology_id),
            source_clinical_record_id = p_clinical_record_id,
            source_diagnosis_id = v_diag_id,
            resolved_at = NULL,
            updated_at = now()
          WHERE clinic_id = p_clinic_id
            AND patient_id = p_patient_id
            AND (cie10_code IS NULL OR trim(cie10_code) = '')
            AND lower(trim(name)) = lower(trim(v_name));

          IF NOT FOUND THEN
            INSERT INTO patient_problem_list (
              clinic_id, patient_id, name, cie10_code, pathology_id, status,
              source_clinical_record_id, source_diagnosis_id, created_by
            )
            VALUES (
              p_clinic_id, p_patient_id, v_name, NULL, v_pathology_id, 'active',
              p_clinical_record_id, v_diag_id, p_actor
            );
          END IF;
        END IF;
      END IF;

      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  v_idx := 0;
  IF jsonb_typeof(COALESCE(p_treatments_json, '[]'::jsonb)) = 'array' THEN
    FOR v_tx IN SELECT value FROM jsonb_array_elements(COALESCE(p_treatments_json, '[]'::jsonb))
    LOOP
      v_product := NULLIF(trim(COALESCE(v_tx->>'product', v_tx->>'name', '')), '');
      IF v_product IS NULL THEN
        CONTINUE;
      END IF;

      BEGIN
        v_treatment_id := NULLIF(trim(COALESCE(v_tx->>'clinical_treatment_id', '')), '')::uuid;
      EXCEPTION WHEN others THEN
        v_treatment_id := NULL;
      END;

      v_treatment_kind := NULLIF(trim(COALESCE(v_tx->>'kind', v_tx->>'treatment_kind', '')), '');
      IF v_treatment_kind IS NOT NULL
         AND v_treatment_kind NOT IN ('pharmacologic', 'non_pharmacologic', 'conduct', 'medication', 'free_text') THEN
        v_treatment_kind := 'free_text';
      END IF;
      v_category := NULLIF(trim(COALESCE(v_tx->>'category', '')), '');

      INSERT INTO clinical_record_treatments (
        clinic_id, patient_id, clinical_record_id,
        product, dose, frequency, notes, status, quantity,
        vademecum_code, catalog_source, active_ingredient, sort_order, created_by,
        clinical_treatment_id, treatment_kind, category
      )
      VALUES (
        p_clinic_id, p_patient_id, p_clinical_record_id,
        v_product,
        NULLIF(trim(COALESCE(v_tx->>'dose', '')), ''),
        NULLIF(trim(COALESCE(v_tx->>'frequency', '')), ''),
        NULLIF(trim(COALESCE(v_tx->>'notes', '')), ''),
        COALESCE(NULLIF(trim(COALESCE(v_tx->>'status', '')), ''), 'Actual'),
        CASE
          WHEN jsonb_typeof(v_tx->'quantity') = 'number' THEN (v_tx->>'quantity')::numeric
          ELSE NULL
        END,
        NULLIF(trim(COALESCE(v_tx->>'vademecum_code', '')), ''),
        NULLIF(trim(COALESCE(v_tx->>'catalog_source', '')), ''),
        NULLIF(trim(COALESCE(v_tx->>'active_ingredient', '')), ''),
        v_idx,
        p_actor,
        v_treatment_id,
        v_treatment_kind,
        v_category
      );

      v_idx := v_idx + 1;
    END LOOP;
  END IF;
END;
$$;

-- Seed catalog (idempotent by name+kind).
INSERT INTO clinical_treatments (name, kind, category, synonyms, sort_order)
SELECT v.name, v.kind, v.category, v.synonyms, v.sort_order
FROM (
  VALUES
    -- Farmacológicos (clases terapéuticas; NO son medicamentos concretos)
    ('Analgésico', 'pharmacologic', 'Farmacológicos', ARRAY['analgesico','dolor'], 10),
    ('Antiinflamatorio', 'pharmacologic', 'Farmacológicos', ARRAY['antiinflamatorio','aine'], 20),
    ('Antitérmico', 'pharmacologic', 'Farmacológicos', ARRAY['antitérmico','antitermico','fiebre'], 30),
    ('Antibiótico', 'pharmacologic', 'Farmacológicos', ARRAY['antibiotico','atb'], 40),
    ('Antiviral', 'pharmacologic', 'Farmacológicos', ARRAY['antivirico','antivírico'], 50),
    ('Antifúngico', 'pharmacologic', 'Farmacológicos', ARRAY['antifungico','antifungico'], 60),
    ('Antihistamínico', 'pharmacologic', 'Farmacológicos', ARRAY['antihistaminico','alergia'], 70),
    ('Corticoide', 'pharmacologic', 'Farmacológicos', ARRAY['corticoide','esteroide'], 80),
    ('Broncodilatador', 'pharmacologic', 'Farmacológicos', ARRAY['broncodilatador','inhalador'], 90),
    ('Antihipertensivo', 'pharmacologic', 'Farmacológicos', ARRAY['antihipertensivo','hta'], 100),
    ('Diurético', 'pharmacologic', 'Farmacológicos', ARRAY['diuretico'], 110),
    ('Anticoagulante', 'pharmacologic', 'Farmacológicos', ARRAY['anticoagulante','acenocumarol'], 120),
    ('Antiagregante', 'pharmacologic', 'Farmacológicos', ARRAY['antiagregante','aas'], 130),
    ('Hipolipemiante', 'pharmacologic', 'Farmacológicos', ARRAY['estatina','colesterol'], 140),
    ('Hipoglucemiante', 'pharmacologic', 'Farmacológicos', ARRAY['hipoglucemiante','antidiabetico'], 150),
    ('Insulina', 'pharmacologic', 'Farmacológicos', ARRAY['insulina'], 160),
    ('Antiácido', 'pharmacologic', 'Farmacológicos', ARRAY['antiacido','protector gastrico'], 170),
    ('Antiemético', 'pharmacologic', 'Farmacológicos', ARRAY['antiemetico','nauseas'], 180),
    ('Antiespasmódico', 'pharmacologic', 'Farmacológicos', ARRAY['antiespasmodico','espasmo'], 190),
    ('Laxante', 'pharmacologic', 'Farmacológicos', ARRAY['laxante','constipacion'], 200),
    ('Antidiarreico', 'pharmacologic', 'Farmacológicos', ARRAY['antidiarreico','diarrea'], 210),
    -- No farmacológicos
    ('Reposo', 'non_pharmacologic', 'No farmacológicos', ARRAY['reposo','reposo relativo'], 300),
    ('Hidratación', 'non_pharmacologic', 'No farmacológicos', ARRAY['hidratacion','agua'], 310),
    ('Dieta', 'non_pharmacologic', 'No farmacológicos', ARRAY['dieta'], 320),
    ('Dieta hiposódica', 'non_pharmacologic', 'No farmacológicos', ARRAY['dieta hiposodica','sin sal'], 330),
    ('Actividad física', 'non_pharmacologic', 'No farmacológicos', ARRAY['actividad fisica','ejercicio'], 340),
    ('Descenso de peso', 'non_pharmacologic', 'No farmacológicos', ARRAY['bajar de peso','adelgazar'], 350),
    ('Suspensión tabáquica', 'non_pharmacologic', 'No farmacológicos', ARRAY['dejar de fumar','cesacion tabacaria'], 360),
    ('Kinesiología', 'non_pharmacologic', 'No farmacológicos', ARRAY['kinesiologia','kine'], 370),
    ('Fisioterapia', 'non_pharmacologic', 'No farmacológicos', ARRAY['fisioterapia'], 380),
    ('Rehabilitación', 'non_pharmacologic', 'No farmacológicos', ARRAY['rehabilitacion'], 390),
    ('Psicoterapia', 'non_pharmacologic', 'No farmacológicos', ARRAY['psicoterapia','psicologo'], 400),
    ('Curaciones', 'non_pharmacologic', 'No farmacológicos', ARRAY['curaciones','herida'], 410),
    ('Inmovilización', 'non_pharmacologic', 'No farmacológicos', ARRAY['inmovilizacion','ferula'], 420),
    -- Conductas
    ('Tratamiento ambulatorio', 'conduct', 'Conductas', ARRAY['ambulatorio'], 500),
    ('Continuar tratamiento habitual', 'conduct', 'Conductas', ARRAY['continuar tratamiento','mismo plan'], 510),
    ('Ajustar medicación', 'conduct', 'Conductas', ARRAY['ajustar medicacion','titular'], 520),
    ('Suspender medicación', 'conduct', 'Conductas', ARRAY['suspender medicacion','suspender farmaco'], 530),
    ('Control clínico', 'conduct', 'Conductas', ARRAY['control clinico','control'], 540),
    ('Solicitar laboratorio', 'conduct', 'Conductas', ARRAY['laboratorio','lab'], 550),
    ('Solicitar radiografía', 'conduct', 'Conductas', ARRAY['radiografia','rx'], 560),
    ('Solicitar ecografía', 'conduct', 'Conductas', ARRAY['ecografia','eco'], 570),
    ('Solicitar tomografía', 'conduct', 'Conductas', ARRAY['tomografia','tac','tc'], 580),
    ('Solicitar resonancia', 'conduct', 'Conductas', ARRAY['resonancia','rmn'], 590),
    ('Solicitar ECG', 'conduct', 'Conductas', ARRAY['ecg','electrocardiograma'], 600),
    ('Solicitar Holter', 'conduct', 'Conductas', ARRAY['holter'], 610),
    ('Solicitar MAPA', 'conduct', 'Conductas', ARRAY['mapa','monitoreo ambulatorio'], 620),
    ('Interconsulta', 'conduct', 'Conductas', ARRAY['interconsulta','ic'], 630),
    ('Derivación a especialista', 'conduct', 'Conductas', ARRAY['derivacion especialista','especialista'], 640),
    ('Derivación a guardia', 'conduct', 'Conductas', ARRAY['derivacion guardia','guardia'], 650),
    ('Internación', 'conduct', 'Conductas', ARRAY['internacion','internar'], 660),
    ('Seguimiento', 'conduct', 'Conductas', ARRAY['seguimiento','follow up'], 670)
) AS v(name, kind, category, synonyms, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM clinical_treatments t
  WHERE lower(t.name) = lower(v.name)
    AND t.kind = v.kind
);
