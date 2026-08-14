-- Professional clinical diagnoses catalog (autocomplete for HC/Consultas).
-- Additive: does not rewrite historical clinical_records diagnosis TEXT.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Accent-fold helper (portable; no dependency on unaccent extension privileges).
CREATE OR REPLACE FUNCTION public.immutable_unaccent(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(
    translate(
      coalesce(p_text, ''),
      'áàäâãåāăąÁÀÄÂÃÅĀĂĄéèëêēĕėęěÉÈËÊĒĔĖĘĚíìïîīĭįİÍÌÏÎĪĬĮóòöôõøōŏőÓÒÖÔÕØŌŎŐúùüûūŭůűųÚÙÜÛŪŬŮŰŲñńŇŃçćčÇĆČýÿÝ',
      'aaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiiiiiiiiiiiiiiooooooooooooooooouuuuuuuuuuuuuuuuunnnnccccccyyy'
    )
  );
$$;

CREATE TABLE IF NOT EXISTS clinical_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT,
  snomed_code TEXT,
  cie10_code TEXT,
  cie11_code TEXT,
  category TEXT,
  synonyms TEXT[] NOT NULL DEFAULT '{}'::text[],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinical_diagnoses_name_nonempty CHECK (trim(name) <> '')
);

COMMENT ON TABLE clinical_diagnoses IS
  'Catálogo profesional de diagnósticos (CIE-10/SNOMED) para autocomplete en HC/Consultas.';

CREATE OR REPLACE FUNCTION public.clinical_diagnoses_set_normalized()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_name := public.immutable_unaccent(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_diagnoses_normalized ON clinical_diagnoses;
CREATE TRIGGER trg_clinical_diagnoses_normalized
  BEFORE INSERT OR UPDATE OF name ON clinical_diagnoses
  FOR EACH ROW
  EXECUTE FUNCTION public.clinical_diagnoses_set_normalized();

CREATE INDEX IF NOT EXISTS idx_clinical_diagnoses_active_name
  ON clinical_diagnoses (active, name);
CREATE INDEX IF NOT EXISTS idx_clinical_diagnoses_cie10
  ON clinical_diagnoses (cie10_code)
  WHERE cie10_code IS NOT NULL AND trim(cie10_code) <> '';
CREATE INDEX IF NOT EXISTS idx_clinical_diagnoses_snomed
  ON clinical_diagnoses (snomed_code)
  WHERE snomed_code IS NOT NULL AND trim(snomed_code) <> '';
CREATE INDEX IF NOT EXISTS idx_clinical_diagnoses_normalized_trgm
  ON clinical_diagnoses USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clinical_diagnoses_name_trgm
  ON clinical_diagnoses USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clinical_diagnoses_synonyms_gin
  ON clinical_diagnoses USING gin (synonyms);

ALTER TABLE clinical_diagnoses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_diagnoses_select ON clinical_diagnoses;
CREATE POLICY clinical_diagnoses_select ON clinical_diagnoses FOR SELECT
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
    )
  );

-- Clinic admins / superadmins may maintain the catalog (optional writes).
DROP POLICY IF EXISTS clinical_diagnoses_insert ON clinical_diagnoses;
DROP POLICY IF EXISTS clinical_diagnoses_update ON clinical_diagnoses;
CREATE POLICY clinical_diagnoses_insert ON clinical_diagnoses FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role = 'clinic_admin'
    )
  );
CREATE POLICY clinical_diagnoses_update ON clinical_diagnoses FOR UPDATE
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role = 'clinic_admin'
    )
  );

-- Link selected catalog entries onto per-evolution diagnosis rows (additive).
ALTER TABLE clinical_record_diagnoses
  ADD COLUMN IF NOT EXISTS clinical_diagnosis_id UUID REFERENCES clinical_diagnoses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS snomed_code TEXT,
  ADD COLUMN IF NOT EXISTS cie11_code TEXT;

CREATE INDEX IF NOT EXISTS idx_crd_clinical_diagnosis_id
  ON clinical_record_diagnoses (clinical_diagnosis_id)
  WHERE clinical_diagnosis_id IS NOT NULL;

-- Search RPC: name + synonyms + codes, accent-insensitive, max 10 by default.
CREATE OR REPLACE FUNCTION public.search_clinical_diagnoses(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  normalized_name TEXT,
  snomed_code TEXT,
  cie10_code TEXT,
  cie11_code TEXT,
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
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 10), 25));
BEGIN
  IF auth.uid() IS NULL AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF length(v_q) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.normalized_name,
    d.snomed_code,
    d.cie10_code,
    d.cie11_code,
    d.category,
    d.synonyms
  FROM clinical_diagnoses d
  WHERE d.active = true
    AND (
      d.normalized_name LIKE '%' || v_q || '%'
      OR public.immutable_unaccent(d.name) LIKE '%' || v_q || '%'
      OR EXISTS (
        SELECT 1
        FROM unnest(d.synonyms) AS syn(s)
        WHERE public.immutable_unaccent(syn.s) LIKE '%' || v_q || '%'
      )
      OR (d.cie10_code IS NOT NULL AND lower(d.cie10_code) LIKE v_q || '%')
      OR (d.snomed_code IS NOT NULL AND lower(d.snomed_code) LIKE v_q || '%')
    )
  ORDER BY
    CASE
      WHEN d.normalized_name LIKE v_q || '%' THEN 0
      WHEN EXISTS (
        SELECT 1 FROM unnest(d.synonyms) AS syn(s)
        WHERE public.immutable_unaccent(syn.s) LIKE v_q || '%'
      ) THEN 1
      ELSE 2
    END,
    length(d.name),
    d.name
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_clinical_diagnoses(TEXT, INTEGER) TO authenticated;

-- Refresh child sync to persist catalog ids/codes from JSON (keeps TEXT dual-write).
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
      v_product := NULLIF(trim(COALESCE(v_tx->>'product', '')), '');
      IF v_product IS NULL THEN
        CONTINUE;
      END IF;

      INSERT INTO clinical_record_treatments (
        clinic_id, patient_id, clinical_record_id,
        product, dose, frequency, notes, status, quantity,
        vademecum_code, catalog_source, active_ingredient, sort_order, created_by
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
        p_actor
      );

      v_idx := v_idx + 1;
    END LOOP;
  END IF;
END;
$$;

-- Seed catalog (idempotent by name).
INSERT INTO clinical_diagnoses (name, snomed_code, cie10_code, cie11_code, category, synonyms)
SELECT v.name, v.snomed_code, v.cie10_code, v.cie11_code, v.category, v.synonyms
FROM (
  VALUES
    ('Hipertensión arterial', '38341003', 'I10', 'BA00', 'cardiovascular', ARRAY['hiper','hta','hipertension','hipertensión','presión alta','presion alta']),
    ('Hipertensión arterial esencial', '59621000', 'I10', 'BA00.0', 'cardiovascular', ARRAY['hta esencial','hipertension esencial','hipertensión esencial']),
    ('Hipertensión secundaria', '31992008', 'I15', 'BA01', 'cardiovascular', ARRAY['hta secundaria','hipertension secundaria']),
    ('Hipertensión pulmonar', '70995007', 'I27.0', 'BB01', 'cardiovascular', ARRAY['htp','hipertension pulmonar']),
    ('Diabetes mellitus tipo 2', '44054006', 'E11', '5A11', 'endocrino', ARRAY['dbt2','dm2','diabetes 2','diabetes tipo 2']),
    ('Diabetes mellitus tipo 1', '46635009', 'E10', '5A10', 'endocrino', ARRAY['dbt1','dm1','diabetes 1','diabetes tipo 1']),
    ('Asma bronquial', '195967001', 'J45', 'CA23', 'respiratorio', ARRAY['asma','crisis asmática','crisis asmatica']),
    ('EPOC', '13645005', 'J44.9', 'CA22', 'respiratorio', ARRAY['epoc','enfermedad pulmonar obstructiva crónica','enfermedad pulmonar obstructiva cronica']),
    ('Infección urinaria', '68566005', 'N39.0', 'GC08', 'nefrourologico', ARRAY['itu','infeccion urinaria','infección del tracto urinario']),
    ('Lumbalgia', '279039007', 'M54.5', 'ME84.2', 'musculoesqueletico', ARRAY['lumbago','dolor lumbar','dolor de espalda baja']),
    ('Cefalea tensional', '230470007', 'G44.2', '8A80', 'neurologico', ARRAY['cefalea','dolor de cabeza','cefalea tensional']),
    ('Gastritis', '4556007', 'K29.7', 'DA42', 'digestivo', ARRAY['gastritis aguda','gastritis cronica','gastritis crónica']),
    ('Reflujo gastroesofágico', '235595009', 'K21.9', 'DA22', 'digestivo', ARRAY['erge','reflujo','reflujo gastroesofagico']),
    ('Ansiedad', '197480006', 'F41.9', '6B00', 'salud_mental', ARRAY['trastorno de ansiedad','cuadro ansioso']),
    ('Depresión', '35489007', 'F32.9', '6A70', 'salud_mental', ARRAY['depresion','episodio depresivo','trastorno depresivo']),
    ('Hipotiroidismo', '40930008', 'E03.9', '5A00', 'endocrino', ARRAY['hipotiroidismo primario','tiroides baja']),
    ('Dislipidemia', '370992007', 'E78.5', '5C80', 'metabolico', ARRAY['colesterol alto','hipercolesterolemia','trigliceridos altos']),
    ('Obesidad', '414916001', 'E66.9', '5B81', 'metabolico', ARRAY['sobrepeso','obesidad mórbida','obesidad morbida']),
    ('Insuficiencia cardíaca', '84114007', 'I50.9', 'BD10', 'cardiovascular', ARRAY['icc','falla cardiaca','falla cardíaca','insuficiencia cardiaca']),
    ('Fibrilación auricular', '49436004', 'I48.9', 'BC81.3', 'cardiovascular', ARRAY['fa','fibrilacion auricular','arritmia fa'])
) AS v(name, snomed_code, cie10_code, cie11_code, category, synonyms)
WHERE NOT EXISTS (
  SELECT 1 FROM clinical_diagnoses d WHERE lower(d.name) = lower(v.name)
);
