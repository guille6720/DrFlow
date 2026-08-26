-- DrFlow release 0.2.19 — production migrations bundle
-- Target: nipqdarduknydqptqzup
-- Generated: 2026-08-26T19:13:40.969Z
-- Apply in Supabase SQL Editor IN ORDER. Verify each section before continuing.
-- Preserves existing prod data (additive migrations only).

-- =============================================================================
-- 112 | diagnoses | Clinical diagnoses catalog + search RPC
-- File: supabase/migrations/112_clinical_diagnoses_catalog.sql
-- =============================================================================
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

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('112') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 143 | diagnoses | CIE-10 import schema + RPC update
-- File: supabase/migrations/143_clinical_diagnoses_cie10_import.sql
-- =============================================================================
-- CIE-10-ES catalog import support for clinical_diagnoses (global catalog).
-- Staging-only apply; does not touch production. Additive / idempotent.

ALTER TABLE clinical_diagnoses
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_version TEXT,
  ADD COLUMN IF NOT EXISTS parent_code TEXT,
  ADD COLUMN IF NOT EXISTS level SMALLINT;

COMMENT ON COLUMN clinical_diagnoses.source IS
  'Proveniencia del registro (ej. cie10-es-lista-tabular-enfermedades-pdf). NULL = seed/manual.';
COMMENT ON COLUMN clinical_diagnoses.source_version IS
  'Versión del origen (ej. CIE-10-ES 6a edicion enero 2026 extracto).';
COMMENT ON COLUMN clinical_diagnoses.parent_code IS
  'Código CIE-10 padre cuando aplica (jerarquía tabular).';
COMMENT ON COLUMN clinical_diagnoses.level IS
  'Nivel jerárquico aproximado del código CIE-10 (3=categoría, 4+=subcategorías).';

-- One row per CIE-10 code for the official import source (seed rows keep source NULL).
CREATE UNIQUE INDEX IF NOT EXISTS clinical_diagnoses_cie10_import_uidx
  ON clinical_diagnoses (cie10_code)
  WHERE source = 'cie10-es-lista-tabular-enfermedades-pdf'
    AND cie10_code IS NOT NULL
    AND trim(cie10_code) <> '';

CREATE INDEX IF NOT EXISTS idx_clinical_diagnoses_source
  ON clinical_diagnoses (source)
  WHERE source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_diagnoses_parent_code
  ON clinical_diagnoses (parent_code)
  WHERE parent_code IS NOT NULL AND trim(parent_code) <> '';

-- Slightly broaden code search: allow partial match anywhere in cie10_code (still accent-folded query).
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
      OR (d.cie10_code IS NOT NULL AND lower(d.cie10_code) LIKE '%' || v_q || '%')
      OR (d.snomed_code IS NOT NULL AND lower(d.snomed_code) LIKE v_q || '%')
    )
  ORDER BY
    CASE
      WHEN d.cie10_code IS NOT NULL AND lower(d.cie10_code) = v_q THEN 0
      WHEN d.cie10_code IS NOT NULL AND lower(d.cie10_code) LIKE v_q || '%' THEN 1
      WHEN d.normalized_name LIKE v_q || '%' THEN 2
      WHEN EXISTS (
        SELECT 1 FROM unnest(d.synonyms) AS syn(s)
        WHERE public.immutable_unaccent(syn.s) LIKE v_q || '%'
      ) THEN 3
      ELSE 4
    END,
    length(d.name),
    d.name
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_clinical_diagnoses(TEXT, INTEGER) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('143') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 140 | renapdis | ReNaPDiS Phase 1 — professionals
-- File: supabase/migrations/140_renapdis_phase1_professionals.sql
-- =============================================================================
-- ReNaPDiS Phase 1 readiness: additive professional identity / REFEPS validation fields.
-- Staging-oriented. Does NOT invent Ministry endpoints or CUIR algorithms.
-- Does NOT rewrite prior migrations. Preserves existing RLS on professionals.

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS cuil text,
  ADD COLUMN IF NOT EXISTS refeps_identifier text,
  ADD COLUMN IF NOT EXISTS licensing_jurisdiction text,
  ADD COLUMN IF NOT EXISTS issuing_authority text,
  ADD COLUMN IF NOT EXISTS refeps_specialty text,
  ADD COLUMN IF NOT EXISTS refeps_validation_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS refeps_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS refeps_validation_error text,
  ADD COLUMN IF NOT EXISTS refeps_validation_details jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'professionals_refeps_validation_status_check'
      AND conrelid = 'public.professionals'::regclass
  ) THEN
    ALTER TABLE public.professionals
      ADD CONSTRAINT professionals_refeps_validation_status_check
      CHECK (
        refeps_validation_status IN (
          'sandbox',
          'validated',
          'pending',
          'failed',
          'not_configured'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.professionals.cuil IS
  'CUIL del profesional para identidad ReNaPDiS / REFEPS (Phase 1).';
COMMENT ON COLUMN public.professionals.refeps_identifier IS
  'Identificador REFEPS del profesional cuando esté disponible. Placeholder hasta especificación oficial.';
COMMENT ON COLUMN public.professionals.licensing_jurisdiction IS
  'Jurisdicción de matrícula (p.ej. CABA, Provincia).';
COMMENT ON COLUMN public.professionals.issuing_authority IS
  'Autoridad emisora de la matrícula.';
COMMENT ON COLUMN public.professionals.refeps_specialty IS
  'Especialidad declarada para validación REFEPS (texto libre Phase 1).';
COMMENT ON COLUMN public.professionals.refeps_validation_status IS
  'Estado de validación REFEPS: sandbox | validated | pending | failed | not_configured.';
COMMENT ON COLUMN public.professionals.refeps_validated_at IS
  'Último timestamp de validación (éxito sandbox/oficial o fallo registrado).';
COMMENT ON COLUMN public.professionals.refeps_validation_error IS
  'Detalle de error de la última validación fallida.';
COMMENT ON COLUMN public.professionals.refeps_validation_details IS
  'Detalles no secretos de la última validación (adaptador, modo, mensajes). Sin inventar payload ministerial.';

CREATE INDEX IF NOT EXISTS idx_professionals_clinic_refeps_status
  ON public.professionals (clinic_id, refeps_validation_status)
  WHERE is_active = true;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('140') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 141 | renapdis | ReNaPDiS Phase 2 — patient CUIR
-- File: supabase/migrations/141_renapdis_phase2_patient_cuir.sql
-- =============================================================================
-- ReNaPDiS Phase 2 readiness: patient identity + prescription CUIR / national readiness.
-- Additive only. Does NOT invent Ministry APIs or official DNSISA identifiers.
-- Staging-oriented. Do not apply to production as part of this Phase 2 task.

-- ---------------------------------------------------------------------------
-- Patients: electronic prescription identity fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cuil text,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'dni',
  ADD COLUMN IF NOT EXISTS alt_identifier_type text,
  ADD COLUMN IF NOT EXISTS alt_identifier_value text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_sex_check' AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_sex_check
      CHECK (sex IS NULL OR sex IN ('F', 'M', 'X'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_document_type_check' AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_document_type_check
      CHECK (document_type IN ('dni', 'passport', 'cuit', 'cdi', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_alt_identifier_type_check' AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_alt_identifier_type_check
      CHECK (
        alt_identifier_type IS NULL
        OR alt_identifier_type IN ('cuit', 'cdi', 'passport', 'other')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.patients.cuil IS
  'CUIL del paciente para receta electrónica nacional (Phase 2). Local CRUD no lo exige.';
COMMENT ON COLUMN public.patients.sex IS
  'Sexo registral F|M|X para bloques de receta nacional.';
COMMENT ON COLUMN public.patients.document_type IS
  'Tipo de documento primario (dni por defecto).';
COMMENT ON COLUMN public.patients.alt_identifier_type IS
  'Identificador alternativo permitido cuando no hay CUIL (cuit|cdi|passport|other).';
COMMENT ON COLUMN public.patients.alt_identifier_value IS
  'Valor del identificador alternativo.';

CREATE INDEX IF NOT EXISTS idx_patients_clinic_cuil
  ON public.patients (clinic_id, cuil)
  WHERE cuil IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Prescription drafts: CUIR components + national readiness (additive)
-- ---------------------------------------------------------------------------
ALTER TABLE public.prescription_drafts
  ADD COLUMN IF NOT EXISTS validity_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS prescription_category text NOT NULL DEFAULT 'medication',
  ADD COLUMN IF NOT EXISTS prescription_subtype text,
  ADD COLUMN IF NOT EXISTS national_rx_status text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS cuir_status text NOT NULL DEFAULT 'pending_official_ids',
  ADD COLUMN IF NOT EXISTS cuir_platform_id text,
  ADD COLUMN IF NOT EXISTS cuir_repository_id text,
  ADD COLUMN IF NOT EXISTS cuir_jurisdiction text,
  ADD COLUMN IF NOT EXISTS cuir_type_subtype text,
  ADD COLUMN IF NOT EXISTS cuir_group_id text,
  ADD COLUMN IF NOT EXISTS cuir_item_number text,
  ADD COLUMN IF NOT EXISTS cuir_formatted text,
  ADD COLUMN IF NOT EXISTS diagnosis_coding jsonb,
  ADD COLUMN IF NOT EXISTS fhir_bundle_meta jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prescription_drafts_category_check'
      AND conrelid = 'public.prescription_drafts'::regclass
  ) THEN
    ALTER TABLE public.prescription_drafts
      ADD CONSTRAINT prescription_drafts_category_check
      CHECK (
        prescription_category IN (
          'medication',
          'device',
          'complementary_study',
          'practice',
          'procedure'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prescription_drafts_national_rx_status_check'
      AND conrelid = 'public.prescription_drafts'::regclass
  ) THEN
    ALTER TABLE public.prescription_drafts
      ADD CONSTRAINT prescription_drafts_national_rx_status_check
      CHECK (
        national_rx_status IN (
          'local',
          'sandbox',
          'national_ready',
          'submitted',
          'failed'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prescription_drafts_cuir_status_check'
      AND conrelid = 'public.prescription_drafts'::regclass
  ) THEN
    ALTER TABLE public.prescription_drafts
      ADD CONSTRAINT prescription_drafts_cuir_status_check
      CHECK (cuir_status IN ('sandbox', 'pending_official_ids', 'official'));
  END IF;
END $$;

COMMENT ON COLUMN public.prescription_drafts.national_rx_status IS
  'Phase 2 national e-Rx readiness: local|sandbox|national_ready|submitted|failed.';
COMMENT ON COLUMN public.prescription_drafts.cuir_status IS
  'CUIR environment: sandbox|pending_official_ids|official. Sandbox is never legally valid.';
COMMENT ON COLUMN public.prescription_drafts.cuir_platform_id IS
  'CUIR component 1 — platform id assigned by DNSISA (placeholder until assigned).';
COMMENT ON COLUMN public.prescription_drafts.cuir_repository_id IS
  'CUIR component 2 — repository id assigned by DNSISA (placeholder until assigned).';
COMMENT ON COLUMN public.prescription_drafts.diagnosis_coding IS
  'Terminology coding snapshot (SNOMED/system/display/version) without inventing codes.';

CREATE INDEX IF NOT EXISTS idx_prescription_drafts_clinic_national_rx
  ON public.prescription_drafts (clinic_id, national_rx_status);

-- ---------------------------------------------------------------------------
-- Extend patient create/update RPCs for Phase 2 identity fields (additive)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_patient_with_clinical_profile(
  p_clinic_id UUID,
  p_patient JSONB,
  p_profile JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient patients%ROWTYPE;
BEGIN
  IF NOT (
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'doctor', 'secretary')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO patients (
    clinic_id, first_name, last_name, document_number, document_type, cuil,
    alt_identifier_type, alt_identifier_value, birth_date, sex, phone, email,
    address, insurance_provider, insurance_plan, insurance_number,
    emergency_contact_name, emergency_contact_phone
  )
  VALUES (
    p_clinic_id,
    p_patient->>'first_name',
    p_patient->>'last_name',
    p_patient->>'document_number',
    COALESCE(NULLIF(p_patient->>'document_type', ''), 'dni'),
    NULLIF(p_patient->>'cuil', ''),
    NULLIF(p_patient->>'alt_identifier_type', ''),
    NULLIF(p_patient->>'alt_identifier_value', ''),
    NULLIF(p_patient->>'birth_date', '')::date,
    NULLIF(p_patient->>'sex', ''),
    NULLIF(p_patient->>'phone', ''),
    NULLIF(p_patient->>'email', ''),
    NULLIF(p_patient->>'address', ''),
    NULLIF(p_patient->>'insurance_provider', ''),
    NULLIF(p_patient->>'insurance_plan', ''),
    NULLIF(p_patient->>'insurance_number', ''),
    NULLIF(p_patient->>'emergency_contact_name', ''),
    NULLIF(p_patient->>'emergency_contact_phone', '')
  )
  RETURNING * INTO v_patient;

  IF p_profile IS NOT NULL THEN
    INSERT INTO patient_clinical_profiles (
      patient_id, clinic_id, medical_history, allergies, regular_medication, notes
    )
    VALUES (
      v_patient.id,
      p_clinic_id,
      NULLIF(p_profile->>'medical_history', ''),
      NULLIF(p_profile->>'allergies', ''),
      NULLIF(p_profile->>'regular_medication', ''),
      NULLIF(p_profile->>'notes', '')
    );
  END IF;

  RETURN to_jsonb(v_patient);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_patient_with_clinical_profile(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_patient JSONB,
  p_profile JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old patients%ROWTYPE;
  v_new patients%ROWTYPE;
BEGIN
  IF NOT (
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'doctor', 'secretary')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_old
  FROM patients
  WHERE id = p_patient_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;

  UPDATE patients
  SET
    first_name = COALESCE(p_patient->>'first_name', first_name),
    last_name = COALESCE(p_patient->>'last_name', last_name),
    document_number = COALESCE(p_patient->>'document_number', document_number),
    document_type = COALESCE(NULLIF(p_patient->>'document_type', ''), document_type),
    cuil = COALESCE(NULLIF(p_patient->>'cuil', ''), cuil),
    alt_identifier_type = COALESCE(NULLIF(p_patient->>'alt_identifier_type', ''), alt_identifier_type),
    alt_identifier_value = COALESCE(NULLIF(p_patient->>'alt_identifier_value', ''), alt_identifier_value),
    birth_date = COALESCE(NULLIF(p_patient->>'birth_date', '')::date, birth_date),
    sex = COALESCE(NULLIF(p_patient->>'sex', ''), sex),
    phone = COALESCE(NULLIF(p_patient->>'phone', ''), phone),
    email = COALESCE(NULLIF(p_patient->>'email', ''), email),
    address = COALESCE(NULLIF(p_patient->>'address', ''), address),
    insurance_provider = COALESCE(NULLIF(p_patient->>'insurance_provider', ''), insurance_provider),
    insurance_plan = COALESCE(NULLIF(p_patient->>'insurance_plan', ''), insurance_plan),
    insurance_number = COALESCE(NULLIF(p_patient->>'insurance_number', ''), insurance_number),
    emergency_contact_name = COALESCE(NULLIF(p_patient->>'emergency_contact_name', ''), emergency_contact_name),
    emergency_contact_phone = COALESCE(NULLIF(p_patient->>'emergency_contact_phone', ''), emergency_contact_phone),
    updated_at = now()
  WHERE id = p_patient_id AND clinic_id = p_clinic_id
  RETURNING * INTO v_new;

  IF p_profile IS NOT NULL THEN
    INSERT INTO patient_clinical_profiles (
      patient_id, clinic_id, medical_history, allergies, regular_medication, notes, updated_at
    )
    VALUES (
      p_patient_id,
      p_clinic_id,
      NULLIF(p_profile->>'medical_history', ''),
      NULLIF(p_profile->>'allergies', ''),
      NULLIF(p_profile->>'regular_medication', ''),
      NULLIF(p_profile->>'notes', ''),
      now()
    )
    ON CONFLICT (patient_id) DO UPDATE SET
      medical_history = EXCLUDED.medical_history,
      allergies = EXCLUDED.allergies,
      regular_medication = EXCLUDED.regular_medication,
      notes = EXCLUDED.notes,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object('old', to_jsonb(v_old), 'data', to_jsonb(v_new));
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('141') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 142 | renapdis | ReNaPDiS Phase 3 — fiscalization marker
-- File: supabase/migrations/142_renapdis_phase3_fiscalization_marker.sql
-- =============================================================================
-- ReNaPDiS Phase 3: fiscalization clinic marker (staging readiness).
-- Additive only. Does not weaken RLS. Does not invent Ministry APIs.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS is_fiscalization boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinics.is_fiscalization IS
  'Marks an isolated fiscalization/inspection clinic with synthetic data only. Never production PHI.';

CREATE INDEX IF NOT EXISTS idx_clinics_fiscalization
  ON public.clinics (id)
  WHERE is_fiscalization = true;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('142') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826114420 | security | EXECUTE hardening — security definer
-- File: supabase/migrations/20260826114420_security_definer_execute_hardening.sql
-- =============================================================================
-- Reconcile remote Staging migration 20260826114420_security_definer_execute_hardening
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- Phase 4 security hardening: least-privilege EXECUTE for privileged functions.
-- Staging-only validation. This migration changes privileges/default privileges only.

-- Destructive/internal helpers: remove direct client access.
-- Keep service_role compatibility where it already existed; internal postgres-owned
-- function calls and trigger invocation continue to work independently of client grants.
REVOKE EXECUTE ON FUNCTION public.delete_auth_user_by_email(text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_user_profile_references(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_clinical_record_children(uuid, uuid, uuid, jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_auth_user_before_delete()
  FROM PUBLIC, anon, authenticated;

-- Worker operations: service_role only.
REVOKE EXECUTE ON FUNCTION public.claim_clinic_jobs(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_clinic_jobs(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_clinic_job(uuid, text, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_clinic_job(uuid, text, jsonb, text) TO service_role;

-- Intentional signed-in RPCs: deny anonymous/public direct access, retain authenticated.
REVOKE EXECUTE ON FUNCTION public.delete_own_account(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remove_clinic_member_user(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_clinic_member_user(uuid, uuid) TO authenticated;

-- Future functions must opt in to browser/client access.
-- service_role remains available by default for server-side compatibility.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826114420') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826114605 | security | EXECUTE hardening — authenticated RPCs
-- File: supabase/migrations/20260826114605_authenticated_rpc_execute_hardening.sql
-- =============================================================================
-- Reconcile remote Staging migration 20260826114605_authenticated_rpc_execute_hardening
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- Phase 4 follow-up: remove anonymous EXECUTE from authenticated/clinic-scoped RPCs.
-- Preserve authenticated and service_role execution.

REVOKE EXECUTE ON FUNCTION public.create_staff_appointment_atomic(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid, text, text, boolean, text, text, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_staff_appointment_atomic(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid, text, text, boolean, text, text, text, text, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_clinical_record_atomic(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_clinical_record_atomic(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, text, text, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_clinical_record_atomic(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, timestamptz, text, text, text, text, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_clinical_record_atomic(uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, timestamptz, text, text, text, text, jsonb, jsonb)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_clinical_record_atomic(uuid, uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_clinical_record_atomic(uuid, uuid, uuid, uuid, uuid, text, text, text, text, uuid, text, text, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_clinical_record_atomic(uuid, uuid, uuid, uuid, uuid, text, text, text, text, uuid, timestamptz, text, text, text, text, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_clinical_record_atomic(uuid, uuid, uuid, uuid, uuid, text, text, text, text, uuid, timestamptz, text, text, text, text, jsonb, jsonb)
  TO authenticated, service_role;

-- Public API RPCs are reached through the server/API-key layer or authenticated
-- clinic users. The internal authorization helper rejects unauthenticated callers;
-- remove anonymous EXECUTE as defense in depth.
REVOKE EXECUTE ON FUNCTION public.assert_public_api_clinic_access(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_public_api_clinic_access(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.api_get_appointment(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_get_appointment(uuid, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.api_list_appointments(uuid, timestamptz, timestamptz, uuid, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_list_appointments(uuid, timestamptz, timestamptz, uuid, text, integer)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.api_submit_appointment(uuid, uuid, timestamptz, text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_submit_appointment(uuid, uuid, timestamptz, text, text, text, text, text, text)
  TO authenticated, service_role;;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826114605') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826114630 | security | EXECUTE hardening — internal helpers
-- File: supabase/migrations/20260826114630_internal_helper_execute_hardening.sql
-- =============================================================================
-- Reconcile remote Staging migration 20260826114630_internal_helper_execute_hardening
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- Phase 4 pack 3: internal trigger/helper functions must not be direct API surfaces.

REVOKE EXECUTE ON FUNCTION public._maintain_audit_refs_for_user_deletion(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._nullify_profile_ref(text, text, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._reassign_profile_ref(text, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.onboard_clinic_entitlement_subscription()
  FROM PUBLIC, anon, authenticated;

-- Worker-only notification queue operations.
REVOKE EXECUTE ON FUNCTION public.claim_appointment_notifications(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_appointment_notifications(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_appointment_notification(uuid, public.reminder_status, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_appointment_notification(uuid, public.reminder_status, text) TO service_role;

-- Maintenance job.
REVOKE EXECUTE ON FUNCTION public.purge_old_observability_events(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_observability_events(integer) TO service_role;;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826114630') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826120601 | security | Anon allowlist for public portal/booking
-- File: supabase/migrations/20260826120601_security_definer_anon_allowlist.sql
-- =============================================================================
-- Reconcile remote Staging migration 20260826120601_security_definer_anon_allowlist
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- DrFlow Phase 5: explicit anonymous allowlist for SECURITY DEFINER RPCs.
-- Staging only. Preserve signed-in/service access while removing anonymous
-- execution from every currently exposed SECURITY DEFINER function except
-- the intentional public portal/booking endpoints below.

DO $$
DECLARE
  r record;
  public_anon text[] := ARRAY[
    'cancel_patient_appointment',
    'get_patient_appointment_statuses',
    'get_patient_portal_appointments',
    'get_public_booking_occupancy',
    'record_patient_data_consent',
    'resolve_portal_clinic_id',
    'submit_public_booking'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);

    IF r.proname = ANY(public_anon) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.fn);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.fn);
    END IF;
  END LOOP;
END
$$;;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826120601') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826120735 | security | Public portal identity hardening
-- File: supabase/migrations/20260826120735_public_portal_identity_hardening.sql
-- =============================================================================
-- Reconcile remote Staging migration 20260826120735_public_portal_identity_hardening
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- DrFlow Phase 5: protect patient portal functions that relied on slug + DNI only.
-- Staging only. These operations must require an authenticated/signed patient session
-- or a cryptographically strong scoped portal token before anonymous access is restored.

REVOKE EXECUTE ON FUNCTION public.cancel_patient_appointment(text,text,uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_patient_appointment_statuses(text,text,uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_patient_portal_appointments(text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_patient_data_consent(text,text,text,text,boolean) FROM PUBLIC, anon;

-- Keep signed-in/server compatibility while public patient identity is redesigned.
GRANT EXECUTE ON FUNCTION public.cancel_patient_appointment(text,text,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_appointment_statuses(text,text,uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_portal_appointments(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_patient_data_consent(text,text,text,text,boolean) TO authenticated, service_role;

-- Public booking must not overwrite an existing patient's demographics/contact details
-- based solely on knowledge of a document number.
CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_slug text,
  p_professional_id uuid,
  p_start_at timestamptz,
  p_first_name text,
  p_last_name text,
  p_document_number text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_consent_type text DEFAULT NULL,
  p_consent_document_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic_id UUID;
  v_link_id UUID;
  v_patient_id UUID;
  v_appointment_id UUID;
  v_duration INTEGER;
  v_end_at TIMESTAMPTZ;
  v_prof_clinic UUID;
  v_document_number TEXT := trim(p_document_number);
BEGIN
  IF v_document_number IS NULL OR length(v_document_number) < 6 THEN
    PERFORM public.raise_app_error('INVALID_DOCUMENT_NUMBER', 'Documento invÃ¡lido');
  END IF;
  IF trim(coalesce(p_first_name, '')) = '' OR trim(coalesce(p_last_name, '')) = '' THEN
    PERFORM public.raise_app_error('PATIENT_NAME_REQUIRED', 'Nombre y apellido son obligatorios');
  END IF;

  SELECT bl.clinic_id, bl.id INTO v_clinic_id, v_link_id
  FROM public.public_booking_links bl
  WHERE bl.slug = p_slug AND bl.is_active = true;

  IF v_clinic_id IS NULL THEN
    PERFORM public.raise_app_error('INVALID_BOOKING_SLUG', 'Link de reserva invÃ¡lido o inactivo');
  END IF;

  SELECT clinic_id INTO v_prof_clinic
  FROM public.professionals
  WHERE id = p_professional_id AND is_active = true;

  IF v_prof_clinic IS NULL OR v_prof_clinic <> v_clinic_id THEN
    PERFORM public.raise_app_error('INVALID_PROFESSIONAL_FOR_CLINIC', 'Profesional no vÃ¡lido para esta clÃ­nica');
  END IF;

  IF p_start_at < now() THEN
    PERFORM public.raise_app_error('BOOKING_SLOT_IN_PAST', 'El horario seleccionado ya pasÃ³');
  END IF;

  SELECT default_appointment_duration INTO v_duration
  FROM public.clinics WHERE id = v_clinic_id;
  v_end_at := p_start_at + (COALESCE(v_duration, 30) || ' minutes')::interval;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.professional_id = p_professional_id
      AND a.status NOT IN ('cancelled'::public.appointment_status)
      AND a.start_at < v_end_at
      AND a.end_at > p_start_at
  ) THEN
    PERFORM public.raise_app_error('BOOKING_SLOT_UNAVAILABLE', 'El horario ya no estÃ¡ disponible');
  END IF;

  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE clinic_id = v_clinic_id AND document_number = v_document_number;

  IF v_patient_id IS NULL THEN
    INSERT INTO public.patients (clinic_id, first_name, last_name, document_number, phone, email)
    VALUES (
      v_clinic_id,
      trim(p_first_name),
      trim(p_last_name),
      v_document_number,
      trim(p_phone),
      NULLIF(trim(p_email), '')
    )
    RETURNING id INTO v_patient_id;
  END IF;

  INSERT INTO public.appointments (
    clinic_id, patient_id, professional_id, location_id, specialty_id,
    start_at, end_at, status, notes, booking_source
  )
  SELECT
    v_clinic_id,
    v_patient_id,
    p_professional_id,
    pro.location_id,
    pro.specialty_id,
    p_start_at,
    v_end_at,
    'pending'::public.appointment_status,
    COALESCE(p_reason, 'Solicitud online'),
    'online'
  FROM public.professionals pro
  WHERE pro.id = p_professional_id
  RETURNING id INTO v_appointment_id;

  IF p_consent_type IS NOT NULL AND trim(p_consent_type) <> '' THEN
    INSERT INTO public.consent_records (
      clinic_id, patient_id, consent_type, granted, granted_at, document_version
    )
    VALUES (
      v_clinic_id,
      v_patient_id,
      trim(p_consent_type),
      true,
      now(),
      p_consent_document_version
    );
  END IF;

  PERFORM public.enqueue_appointment_notification_events(v_appointment_id, 'booking');

  -- Do not expose patient_id or clinic_id to anonymous callers.
  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'status', 'pending'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.submit_public_booking(text,uuid,timestamptz,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(text,uuid,timestamptz,text,text,text,text,text,text,text,text) TO anon, authenticated, service_role;;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826120735') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826120822 | security | Internal service-only security definer
-- File: supabase/migrations/20260826120822_security_definer_internal_service_only.sql
-- =============================================================================
-- Reconcile remote Staging migration 20260826120822_security_definer_internal_service_only
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- DrFlow Phase 5: remove direct browser access from internal SECURITY DEFINER helpers.
-- Staging only.

-- Patient portal legacy identity model (slug + DNI) is not a sufficient authorization factor.
-- Keep server-only until a signed, scoped patient session/token is implemented.
REVOKE EXECUTE ON FUNCTION public.cancel_patient_appointment(text,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_patient_appointment_statuses(text,text,uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_patient_portal_appointments(text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_patient_data_consent(text,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_patient_appointment(text,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_appointment_statuses(text,text,uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_portal_appointments(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_patient_data_consent(text,text,text,text,boolean) TO service_role;

-- Internal/migration/trigger helpers. Direct authenticated execution is unnecessary and unsafe.
REVOKE EXECUTE ON FUNCTION public._upsert_global_pami_planilla_template(text,text,text,integer,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.append_appointment_status_history(uuid,uuid,public.appointment_status,public.appointment_status,public.waiting_room_status,public.waiting_room_status,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_pending_appointment_reminders(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_appointment_notification_events(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_lapsed_clinic_entitlement_trials(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._upsert_global_pami_planilla_template(text,text,text,integer,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.append_appointment_status_history(uuid,uuid,public.appointment_status,public.appointment_status,public.waiting_room_status,public.waiting_room_status,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_pending_appointment_reminders(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_appointment_notification_events(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_lapsed_clinic_entitlement_trials(uuid) TO service_role;;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826120822') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826123241 | security | Patient portal token sessions (Phase 6)
-- File: supabase/migrations/20260826123241_patient_portal_token_sessions.sql
-- =============================================================================
-- Reconcile remote Staging migration 20260826123241_patient_portal_token_sessions
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.
-- Idempotent recreation for local history parity.

CREATE TABLE IF NOT EXISTS public.patient_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['appointments:read','appointments:cancel','consent:write']::text[],
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_portal_sessions_clinic_patient
  ON public.patient_portal_sessions (clinic_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_portal_sessions_expires_at
  ON public.patient_portal_sessions (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.patient_portal_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.patient_portal_sessions IS
  'Hashed magic-link sessions for patient portal. Raw token never stored.';

CREATE OR REPLACE FUNCTION public._resolve_patient_portal_session(
  p_token text,
  p_required_scope text
)
RETURNS TABLE(session_id uuid, clinic_id uuid, patient_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_hash bytea;
  v_session_id uuid;
  v_clinic_id uuid;
  v_patient_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_PORTAL_SESSION';
  END IF;
  IF p_required_scope IS NULL OR p_required_scope NOT IN ('appointments:read','appointments:cancel','consent:write') THEN
    RAISE EXCEPTION 'INVALID_PORTAL_SESSION';
  END IF;

  v_hash := extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256');

  SELECT s.id, s.clinic_id, s.patient_id, s.expires_at
    INTO v_session_id, v_clinic_id, v_patient_id, v_expires_at
  FROM public.patient_portal_sessions s
  WHERE s.token_hash = v_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > pg_catalog.now()
    AND p_required_scope = ANY(s.scopes)
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PORTAL_SESSION';
  END IF;

  UPDATE public.patient_portal_sessions
  SET last_used_at = pg_catalog.now()
  WHERE id = v_session_id;

  RETURN QUERY SELECT v_session_id, v_clinic_id, v_patient_id, v_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public._resolve_patient_portal_session(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._resolve_patient_portal_session(text, text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_patient_portal_session(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_expires_minutes integer DEFAULT 30,
  p_scopes text[] DEFAULT ARRAY['appointments:read','appointments:cancel','consent:write']::text[]
)
RETURNS TABLE(session_id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_token text;
  v_token_hash bytea;
  v_expires_at timestamptz;
  v_session_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_expires_minutes IS NULL OR p_expires_minutes < 5 OR p_expires_minutes > 1440 THEN
    RAISE EXCEPTION 'INVALID_EXPIRY';
  END IF;

  IF p_scopes IS NULL
     OR pg_catalog.cardinality(p_scopes) = 0
     OR NOT (p_scopes <@ ARRAY['appointments:read','appointments:cancel','consent:write']::text[]) THEN
    RAISE EXCEPTION 'INVALID_SCOPES';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_user_id AND pr.is_superadmin = true
  ) AND NOT EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = p_clinic_id
      AND cm.user_id = v_user_id
      AND cm.is_active = true
      AND cm.role IN ('clinic_admin'::public.user_role, 'doctor'::public.user_role, 'secretary'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = p_patient_id
      AND p.clinic_id = p_clinic_id
      AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256');
  v_expires_at := pg_catalog.now() + pg_catalog.make_interval(mins => p_expires_minutes);

  INSERT INTO public.patient_portal_sessions (
    clinic_id, patient_id, token_hash, scopes, expires_at, created_by
  ) VALUES (
    p_clinic_id, p_patient_id, v_token_hash, p_scopes, v_expires_at, v_user_id
  )
  RETURNING id INTO v_session_id;

  RETURN QUERY SELECT v_session_id, v_token, v_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_patient_portal_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinic_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT s.clinic_id INTO v_clinic_id
  FROM public.patient_portal_sessions s
  WHERE s.id = p_session_id;

  IF v_clinic_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_user_id AND pr.is_superadmin = true
  ) AND NOT EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = v_clinic_id
      AND cm.user_id = v_user_id
      AND cm.is_active = true
      AND cm.role IN ('clinic_admin'::public.user_role, 'doctor'::public.user_role, 'secretary'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.patient_portal_sessions
  SET revoked_at = COALESCE(revoked_at, pg_catalog.now())
  WHERE id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_patient_portal_session(uuid, uuid, integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_patient_portal_session(uuid, uuid, integer, text[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.revoke_patient_portal_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_patient_portal_session(uuid) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826123241') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826123459 | security | Portal professional join fix
-- File: supabase/migrations/20260826123459_patient_portal_professional_join_fix.sql
-- =============================================================================
-- Reconcile remote Staging migration 20260826123459_patient_portal_professional_join_fix
-- ALREADY APPLIED on staging. Do not re-apply blindly.
-- Ensures get_patient_portal_appointments_v2 joins professionals/profiles correctly.

CREATE OR REPLACE FUNCTION public.get_patient_portal_appointments_v2(p_token text)
RETURNS TABLE(
  appointment_id uuid,
  status public.appointment_status,
  start_at timestamptz,
  end_at timestamptz,
  booking_source text,
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by_type text,
  professional_name text,
  patient_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session
  FROM public._resolve_patient_portal_session(p_token, 'appointments:read');

  RETURN QUERY
  SELECT
    a.id,
    a.status,
    a.start_at,
    a.end_at,
    a.booking_source,
    a.cancellation_reason,
    a.cancelled_at,
    a.cancelled_by_type,
    COALESCE(pro.display_name, pr.full_name, 'Profesional') AS professional_name,
    pg_catalog.btrim(pg_catalog.concat_ws(' ', pat.first_name, pat.last_name)) AS patient_name,
    a.created_at
  FROM public.appointments a
  JOIN public.patients pat ON pat.id = a.patient_id
  LEFT JOIN public.professionals pro ON pro.id = a.professional_id
  LEFT JOIN public.profiles pr ON pr.id = pro.user_id
  WHERE a.clinic_id = v_session.clinic_id
    AND a.patient_id = v_session.patient_id
    AND a.booking_source = 'online'
    AND (
      a.start_at >= pg_catalog.now() - interval '30 days'
      OR a.status IN ('pending'::public.appointment_status, 'confirmed'::public.appointment_status)
    )
  ORDER BY a.start_at DESC
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_appointment_statuses_v2(
  p_token text,
  p_appointment_ids uuid[]
)
RETURNS TABLE(
  appointment_id uuid,
  status public.appointment_status,
  start_at timestamptz,
  booking_source text,
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session record;
BEGIN
  IF p_appointment_ids IS NULL OR pg_catalog.cardinality(p_appointment_ids) = 0 THEN
    RETURN;
  END IF;

  SELECT * INTO v_session
  FROM public._resolve_patient_portal_session(p_token, 'appointments:read');

  RETURN QUERY
  SELECT a.id, a.status, a.start_at, a.booking_source,
         a.cancellation_reason, a.cancelled_at, a.cancelled_by_type
  FROM public.appointments a
  WHERE a.id = ANY(p_appointment_ids)
    AND a.clinic_id = v_session.clinic_id
    AND a.patient_id = v_session.patient_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_patient_appointment_v2(
  p_token text,
  p_appointment_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session record;
  v_reason text := pg_catalog.btrim(p_reason);
BEGIN
  IF v_reason IS NULL OR pg_catalog.length(v_reason) < 3 OR pg_catalog.length(v_reason) > 500 THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;

  SELECT * INTO v_session
  FROM public._resolve_patient_portal_session(p_token, 'appointments:cancel');

  UPDATE public.appointments a
  SET status = 'cancelled'::public.appointment_status,
      cancellation_reason = v_reason,
      cancelled_at = pg_catalog.now(),
      cancelled_by_type = 'patient',
      cancelled_by = NULL,
      updated_at = pg_catalog.now()
  WHERE a.id = p_appointment_id
    AND a.clinic_id = v_session.clinic_id
    AND a.patient_id = v_session.patient_id
    AND a.status IN ('pending'::public.appointment_status, 'confirmed'::public.appointment_status);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  PERFORM public.enqueue_appointment_notification_events(p_appointment_id, 'cancellation');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_patient_data_consent_v2(
  p_token text,
  p_consent_type text,
  p_document_version text,
  p_granted boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session record;
  v_type text := pg_catalog.btrim(p_consent_type);
  v_version text := NULLIF(pg_catalog.btrim(p_document_version), '');
BEGIN
  IF v_type IS NULL OR pg_catalog.length(v_type) = 0 OR pg_catalog.length(v_type) > 100 THEN
    RAISE EXCEPTION 'INVALID_CONSENT_TYPE';
  END IF;
  IF v_version IS NOT NULL AND pg_catalog.length(v_version) > 100 THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_VERSION';
  END IF;

  SELECT * INTO v_session
  FROM public._resolve_patient_portal_session(p_token, 'consent:write');

  INSERT INTO public.consent_records (
    clinic_id, patient_id, consent_type, granted, granted_at,
    document_version, purpose, source
  ) VALUES (
    v_session.clinic_id,
    v_session.patient_id,
    v_type,
    COALESCE(p_granted, false),
    CASE WHEN COALESCE(p_granted, false) THEN pg_catalog.now() ELSE NULL END,
    v_version,
    'patient_data_processing_patient_portal',
    'patient_portal_token'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_portal_appointments_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_portal_appointments_v2(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_patient_appointment_statuses_v2(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_appointment_statuses_v2(text, uuid[]) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.cancel_patient_appointment_v2(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_patient_appointment_v2(text, uuid, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_patient_data_consent_v2(text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_patient_data_consent_v2(text, text, text, boolean) TO anon, authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826123459') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826123700 | security | Portal slug session validation
-- File: supabase/migrations/20260826123700_patient_portal_slug_session_validation.sql
-- =============================================================================
-- Reconcile remote Staging migration 20260826123700_patient_portal_slug_session_validation
-- ALREADY APPLIED on staging. Do not re-apply blindly.
-- Token + clinic slug binding for magic-link entry.

CREATE OR REPLACE FUNCTION public.validate_patient_portal_session_v2(
  p_token text,
  p_slug text
)
RETURNS TABLE(valid boolean, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session record;
  v_slug text := pg_catalog.btrim(p_slug);
  v_matches boolean := false;
BEGIN
  IF v_slug IS NULL OR pg_catalog.length(v_slug) = 0 OR pg_catalog.length(v_slug) > 160 THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END IF;

  BEGIN
    SELECT * INTO v_session
    FROM public._resolve_patient_portal_session(p_token, 'appointments:read');
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END;

  SELECT EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = v_session.clinic_id AND c.slug = v_slug
    UNION ALL
    SELECT 1 FROM public.public_booking_links pbl
    WHERE pbl.clinic_id = v_session.clinic_id
      AND pbl.slug = v_slug
      AND pbl.is_active = true
  ) INTO v_matches;

  IF NOT v_matches THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_session.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_patient_portal_session_v2(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_patient_portal_session_v2(text, text) TO anon, authenticated, service_role;

-- Legacy DNI portal RPCs must remain unavailable to browser (anon) callers.
REVOKE EXECUTE ON FUNCTION public.get_patient_portal_appointments(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_patient_appointment_statuses(text, text, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_patient_appointment(text, text, uuid, text) FROM anon;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826123700') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826140000 | security | Public booking preserve demographics
-- File: supabase/migrations/20260826140000_public_booking_preserve_patient_demographics.sql
-- =============================================================================
-- Reconcile remote Staging migration 20260826140000_public_booking_preserve_patient_demographics
-- ALREADY APPLIED on staging (gprmsufvhabntbrytwyi). Do not re-apply blindly.

-- Phase 6: public booking must not overwrite demographics of an existing patient.
-- New patients are still inserted; existing records keep staff-managed contact data.

CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_slug TEXT,
  p_professional_id UUID,
  p_start_at TIMESTAMPTZ,
  p_first_name TEXT,
  p_last_name TEXT,
  p_document_number TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_consent_type TEXT DEFAULT NULL,
  p_consent_document_version TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
  v_link_id UUID;
  v_patient_id UUID;
  v_appointment_id UUID;
  v_duration INTEGER;
  v_end_at TIMESTAMPTZ;
  v_prof_clinic UUID;
BEGIN
  SELECT bl.clinic_id, bl.id INTO v_clinic_id, v_link_id
  FROM public_booking_links bl
  WHERE bl.slug = p_slug AND bl.is_active = true;

  IF v_clinic_id IS NULL THEN
    PERFORM raise_app_error('INVALID_BOOKING_SLUG', 'Link de reserva invÃ¡lido o inactivo');
  END IF;

  SELECT clinic_id INTO v_prof_clinic
  FROM professionals
  WHERE id = p_professional_id AND is_active = true;

  IF v_prof_clinic IS NULL OR v_prof_clinic <> v_clinic_id THEN
    PERFORM raise_app_error(
      'INVALID_PROFESSIONAL_FOR_CLINIC',
      'Profesional no vÃ¡lido para esta clÃ­nica'
    );
  END IF;

  IF p_start_at < now() THEN
    PERFORM raise_app_error('BOOKING_SLOT_IN_PAST', 'El horario seleccionado ya pasÃ³');
  END IF;

  SELECT default_appointment_duration INTO v_duration FROM clinics WHERE id = v_clinic_id;
  v_end_at := p_start_at + (COALESCE(v_duration, 30) || ' minutes')::interval;

  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.professional_id = p_professional_id
      AND a.status NOT IN ('cancelled'::appointment_status)
      AND a.start_at < v_end_at
      AND a.end_at > p_start_at
  ) THEN
    PERFORM raise_app_error('BOOKING_SLOT_UNAVAILABLE', 'El horario ya no estÃ¡ disponible');
  END IF;

  SELECT id INTO v_patient_id
  FROM patients
  WHERE clinic_id = v_clinic_id AND document_number = trim(p_document_number);

  IF v_patient_id IS NULL THEN
    INSERT INTO patients (clinic_id, first_name, last_name, document_number, phone, email)
    VALUES (
      v_clinic_id,
      trim(p_first_name),
      trim(p_last_name),
      trim(p_document_number),
      trim(p_phone),
      NULLIF(trim(p_email), '')
    )
    RETURNING id INTO v_patient_id;
  END IF;
  -- Existing patient: do NOT overwrite first_name, last_name, phone, or email.

  INSERT INTO appointments (
    clinic_id, patient_id, professional_id, location_id, specialty_id,
    start_at, end_at, status, notes, booking_source
  )
  SELECT
    v_clinic_id,
    v_patient_id,
    p_professional_id,
    pro.location_id,
    pro.specialty_id,
    p_start_at,
    v_end_at,
    'pending'::appointment_status,
    COALESCE(p_reason, 'Solicitud online'),
    'online'
  FROM professionals pro
  WHERE pro.id = p_professional_id
  RETURNING id INTO v_appointment_id;

  IF p_consent_type IS NOT NULL AND trim(p_consent_type) <> '' THEN
    INSERT INTO consent_records (
      clinic_id, patient_id, consent_type, granted, granted_at, document_version
    )
    VALUES (
      v_clinic_id,
      v_patient_id,
      trim(p_consent_type),
      true,
      now(),
      p_consent_document_version
    );
  END IF;

  PERFORM public.enqueue_appointment_notification_events(v_appointment_id, 'booking');

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'patient_id', v_patient_id,
    'clinic_id', v_clinic_id,
    'status', 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_booking(
  text, uuid, timestamptz, text, text, text, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(
  text, uuid, timestamptz, text, text, text, text, text, text, text, text
) TO anon, authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826140000') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20260826151000 | security | RLS staff policies authenticated-only
-- File: supabase/migrations/20260826151000_rls_staff_policies_authenticated_only.sql
-- =============================================================================
-- Phase 6: staff RLS policies that call auth helpers must not apply to anon.
-- After Phase 5 EXECUTE hardening, anon cannot call can_manage_clinic / is_superadmin /
-- user_clinic_ids. PUBLIC policies that reference those helpers make OR-combined
-- SELECT fail closed for anonymous public booking / portal pages.

-- public_booking_links
DROP POLICY IF EXISTS public_booking_links_all ON public.public_booking_links;
CREATE POLICY public_booking_links_all ON public.public_booking_links
  FOR ALL TO authenticated
  USING (can_manage_clinic(clinic_id))
  WITH CHECK (can_manage_clinic(clinic_id));

-- clinics
DROP POLICY IF EXISTS clinics_select ON public.clinics;
CREATE POLICY clinics_select ON public.clinics
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (id IN (SELECT user_clinic_ids())));

-- professionals
DROP POLICY IF EXISTS professionals_manage ON public.professionals;
CREATE POLICY professionals_manage ON public.professionals
  FOR ALL TO authenticated
  USING (can_manage_clinic(clinic_id))
  WITH CHECK (can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS professionals_select ON public.professionals;
CREATE POLICY professionals_select ON public.professionals
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (clinic_id IN (SELECT user_clinic_ids())));

-- specialties
DROP POLICY IF EXISTS specialties_manage ON public.specialties;
CREATE POLICY specialties_manage ON public.specialties
  FOR ALL TO authenticated
  USING (can_manage_clinic(clinic_id))
  WITH CHECK (can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS specialties_select ON public.specialties;
CREATE POLICY specialties_select ON public.specialties
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (clinic_id IN (SELECT user_clinic_ids())));

-- locations (embedded / related public clinic data)
DROP POLICY IF EXISTS locations_manage ON public.locations;
CREATE POLICY locations_manage ON public.locations
  FOR ALL TO authenticated
  USING (can_manage_clinic(clinic_id))
  WITH CHECK (can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS locations_select ON public.locations;
CREATE POLICY locations_select ON public.locations
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (clinic_id IN (SELECT user_clinic_ids())));

-- availability_rules (public occupancy / booking)
DROP POLICY IF EXISTS availability_rules_select ON public.availability_rules;
CREATE POLICY availability_rules_select ON public.availability_rules
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (clinic_id IN (SELECT user_clinic_ids())));

-- clinics_select_setup EXISTS into clinic_members; that table's select policy
-- calls user_clinic_ids and must not be evaluated for anonymous callers.
DROP POLICY IF EXISTS clinics_select_setup ON public.clinics;
CREATE POLICY clinics_select_setup ON public.clinics
  FOR SELECT TO authenticated
  USING (
    (auth.uid() IS NOT NULL)
    AND (NOT (EXISTS (
      SELECT 1 FROM clinic_members cm WHERE cm.clinic_id = clinics.id
    )))
  );

DROP POLICY IF EXISTS clinic_members_select ON public.clinic_members;
CREATE POLICY clinic_members_select ON public.clinic_members
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (clinic_id IN (SELECT user_clinic_ids())));

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260826151000') ON CONFLICT DO NOTHING;

-- =============================================================================
-- 144 | diagnoses | Fix clinical_diagnoses SELECT RLS (post-hardening)
-- File: supabase/migrations/144_clinical_diagnoses_rls_select_authenticated.sql
-- =============================================================================
-- Fix clinical_diagnoses catalog SELECT for post-hardening EXECUTE grants.
-- anon cannot EXECUTE is_superadmin(); evaluating it inside a PUBLIC RLS policy
-- raises "permission denied for function is_superadmin" instead of returning no rows.
-- Scope policy to authenticated staff only (catalog is not public).

DROP POLICY IF EXISTS clinical_diagnoses_select ON clinical_diagnoses;
CREATE POLICY clinical_diagnoses_select ON clinical_diagnoses
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('144') ON CONFLICT DO NOTHING;
