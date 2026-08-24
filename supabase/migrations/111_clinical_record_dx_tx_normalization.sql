-- Fase 2: normalización de diagnósticos/tratamientos en tablas hijas + problem list.
-- Aditiva: conserva diagnosis/indications TEXT y diagnoses_json/treatments_json (dual-write).
-- Staging: gprmsufvhabntbrytwyi
--
-- Requiere columnas de 110. Guard idempotente por si se pega 111 sin 110 en el SQL Editor.

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS diagnosis_cie10 TEXT,
  ADD COLUMN IF NOT EXISTS diagnoses_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS treatments_json JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Child tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinical_record_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinical_record_id UUID NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cie10_code TEXT,
  pathology_id UUID REFERENCES pathologies(id) ON DELETE SET NULL,
  is_chronic BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinical_record_diagnoses_name_nonempty CHECK (trim(name) <> '')
);

CREATE TABLE IF NOT EXISTS clinical_record_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinical_record_id UUID NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  dose TEXT,
  frequency TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Actual',
  quantity NUMERIC(12, 2),
  vademecum_code TEXT,
  catalog_source TEXT,
  active_ingredient TEXT,
  national_medication_id UUID REFERENCES national_medications(id) ON DELETE SET NULL,
  drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clinical_record_treatments_product_nonempty CHECK (trim(product) <> '')
);

CREATE TABLE IF NOT EXISTS patient_problem_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cie10_code TEXT,
  pathology_id UUID REFERENCES pathologies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved', 'inactive')),
  source_clinical_record_id UUID REFERENCES clinical_records(id) ON DELETE SET NULL,
  source_diagnosis_id UUID REFERENCES clinical_record_diagnoses(id) ON DELETE SET NULL,
  noted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT patient_problem_list_name_nonempty CHECK (trim(name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_crd_clinic_patient
  ON clinical_record_diagnoses (clinic_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crd_record
  ON clinical_record_diagnoses (clinical_record_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_crd_clinic_cie10
  ON clinical_record_diagnoses (clinic_id, cie10_code)
  WHERE cie10_code IS NOT NULL AND trim(cie10_code) <> '';

CREATE INDEX IF NOT EXISTS idx_crt_clinic_patient
  ON clinical_record_treatments (clinic_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crt_record
  ON clinical_record_treatments (clinical_record_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_crt_clinic_vademecum
  ON clinical_record_treatments (clinic_id, vademecum_code)
  WHERE vademecum_code IS NOT NULL AND trim(vademecum_code) <> '';
CREATE INDEX IF NOT EXISTS idx_crt_clinic_product
  ON clinical_record_treatments (clinic_id, lower(product));

CREATE INDEX IF NOT EXISTS idx_ppl_clinic_patient_status
  ON patient_problem_list (clinic_id, patient_id, status, noted_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ppl_clinic_patient_cie10
  ON patient_problem_list (clinic_id, patient_id, cie10_code)
  WHERE cie10_code IS NOT NULL AND trim(cie10_code) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_ppl_clinic_patient_name
  ON patient_problem_list (clinic_id, patient_id, lower(trim(name)))
  WHERE cie10_code IS NULL OR trim(cie10_code) = '';

COMMENT ON TABLE clinical_record_diagnoses IS
  'Diagnósticos estructurados por evolución (Fase 2). Dual-write con clinical_records.diagnosis / diagnoses_json.';
COMMENT ON TABLE clinical_record_treatments IS
  'Tratamientos estructurados por evolución (Fase 2). Dual-write con clinical_records.indications / treatments_json.';
COMMENT ON TABLE patient_problem_list IS
  'Problemas activos/crónicos del paciente, independientes de una sola evolución.';

ALTER TABLE clinical_record_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_record_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_problem_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_record_diagnoses_select ON clinical_record_diagnoses;
DROP POLICY IF EXISTS clinical_record_diagnoses_insert ON clinical_record_diagnoses;
DROP POLICY IF EXISTS clinical_record_diagnoses_update ON clinical_record_diagnoses;
DROP POLICY IF EXISTS clinical_record_diagnoses_delete ON clinical_record_diagnoses;
CREATE POLICY clinical_record_diagnoses_select ON clinical_record_diagnoses FOR SELECT
  USING (is_superadmin() OR can_view_clinical(clinic_id));
CREATE POLICY clinical_record_diagnoses_insert ON clinical_record_diagnoses FOR INSERT
  WITH CHECK (is_superadmin() OR can_write_clinical(clinic_id));
CREATE POLICY clinical_record_diagnoses_update ON clinical_record_diagnoses FOR UPDATE
  USING (is_superadmin() OR can_write_clinical(clinic_id));
CREATE POLICY clinical_record_diagnoses_delete ON clinical_record_diagnoses FOR DELETE
  USING (is_superadmin() OR can_write_clinical(clinic_id));

DROP POLICY IF EXISTS clinical_record_treatments_select ON clinical_record_treatments;
DROP POLICY IF EXISTS clinical_record_treatments_insert ON clinical_record_treatments;
DROP POLICY IF EXISTS clinical_record_treatments_update ON clinical_record_treatments;
DROP POLICY IF EXISTS clinical_record_treatments_delete ON clinical_record_treatments;
CREATE POLICY clinical_record_treatments_select ON clinical_record_treatments FOR SELECT
  USING (is_superadmin() OR can_view_clinical(clinic_id));
CREATE POLICY clinical_record_treatments_insert ON clinical_record_treatments FOR INSERT
  WITH CHECK (is_superadmin() OR can_write_clinical(clinic_id));
CREATE POLICY clinical_record_treatments_update ON clinical_record_treatments FOR UPDATE
  USING (is_superadmin() OR can_write_clinical(clinic_id));
CREATE POLICY clinical_record_treatments_delete ON clinical_record_treatments FOR DELETE
  USING (is_superadmin() OR can_write_clinical(clinic_id));

DROP POLICY IF EXISTS patient_problem_list_select ON patient_problem_list;
DROP POLICY IF EXISTS patient_problem_list_insert ON patient_problem_list;
DROP POLICY IF EXISTS patient_problem_list_update ON patient_problem_list;
DROP POLICY IF EXISTS patient_problem_list_delete ON patient_problem_list;
CREATE POLICY patient_problem_list_select ON patient_problem_list FOR SELECT
  USING (is_superadmin() OR can_view_clinical(clinic_id));
CREATE POLICY patient_problem_list_insert ON patient_problem_list FOR INSERT
  WITH CHECK (is_superadmin() OR can_write_clinical(clinic_id));
CREATE POLICY patient_problem_list_update ON patient_problem_list FOR UPDATE
  USING (is_superadmin() OR can_write_clinical(clinic_id));
CREATE POLICY patient_problem_list_delete ON patient_problem_list FOR DELETE
  USING (is_superadmin() OR can_write_clinical(clinic_id));

-- ---------------------------------------------------------------------------
-- Sync children from JSON payloads (used by create/update RPCs)
-- ---------------------------------------------------------------------------

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
  v_pathology_id UUID;
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
      v_pathology_id := NULLIF(trim(COALESCE(v_diag->>'pathology_id', '')), '')::uuid;
      v_is_chronic := COALESCE((v_diag->>'is_chronic')::boolean, false);

      INSERT INTO clinical_record_diagnoses (
        clinic_id, patient_id, clinical_record_id,
        name, cie10_code, pathology_id, is_chronic, sort_order, created_by
      )
      VALUES (
        p_clinic_id, p_patient_id, p_clinical_record_id,
        v_name, v_cie10, v_pathology_id, v_is_chronic, v_idx, p_actor
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

GRANT EXECUTE ON FUNCTION public.sync_clinical_record_children(
  UUID, UUID, UUID, JSONB, JSONB, UUID
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Recreate atomic RPCs with child sync (same signature as migration 110)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_clinical_record_atomic(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB
);
DROP FUNCTION IF EXISTS public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB
);

CREATE OR REPLACE FUNCTION public.create_clinical_record_atomic(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_appointment_id UUID,
  p_chief_complaint TEXT,
  p_diagnosis TEXT,
  p_evolution TEXT,
  p_indications TEXT,
  p_created_by UUID,
  p_consultation_modality TEXT DEFAULT NULL,
  p_consultation_at TIMESTAMPTZ DEFAULT NULL,
  p_audit_what TEXT DEFAULT 'Creó consulta clínica (SOAP)',
  p_audit_ip TEXT DEFAULT NULL,
  p_audit_user_agent TEXT DEFAULT NULL,
  p_diagnosis_cie10 TEXT DEFAULT NULL,
  p_diagnoses_json JSONB DEFAULT '[]'::jsonb,
  p_treatments_json JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record clinical_records%ROWTYPE;
BEGIN
  IF NOT can_write_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_created_by IS DISTINCT FROM auth.uid() AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO clinical_records (
    clinic_id, patient_id, professional_id, appointment_id,
    chief_complaint, diagnosis, evolution, indications,
    diagnosis_cie10, diagnoses_json, treatments_json,
    created_by, created_at
  )
  VALUES (
    p_clinic_id, p_patient_id, p_professional_id, p_appointment_id,
    p_chief_complaint, p_diagnosis, p_evolution, p_indications,
    NULLIF(trim(COALESCE(p_diagnosis_cie10, '')), ''),
    COALESCE(p_diagnoses_json, '[]'::jsonb),
    COALESCE(p_treatments_json, '[]'::jsonb),
    p_created_by,
    COALESCE(p_consultation_at, now())
  )
  RETURNING * INTO v_record;

  PERFORM public.sync_clinical_record_children(
    v_record.id,
    p_clinic_id,
    p_patient_id,
    COALESCE(p_diagnoses_json, '[]'::jsonb),
    COALESCE(p_treatments_json, '[]'::jsonb),
    p_created_by
  );

  IF p_appointment_id IS NOT NULL THEN
    UPDATE appointments
    SET
      status = 'attended'::appointment_status,
      consultation_modality = COALESCE(
        NULLIF(trim(p_consultation_modality), ''),
        consultation_modality
      ),
      updated_at = now()
    WHERE id = p_appointment_id
      AND clinic_id = p_clinic_id;
  END IF;

  INSERT INTO clinical_record_audit (
    clinical_record_id, clinic_id, patient_id, module, what, action,
    changed_by, new_values, ip_address, user_agent
  )
  VALUES (
    v_record.id,
    p_clinic_id,
    p_patient_id,
    'clinical',
    p_audit_what,
    'create'::audit_action,
    p_created_by,
    to_jsonb(v_record),
    NULLIF(trim(p_audit_ip), '')::inet,
    NULLIF(trim(p_audit_user_agent), '')
  );

  RETURN to_jsonb(v_record);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_clinical_record_atomic(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_clinical_record_atomic(
  p_clinic_id UUID,
  p_record_id UUID,
  p_patient_id UUID,
  p_professional_id UUID,
  p_appointment_id UUID,
  p_chief_complaint TEXT,
  p_diagnosis TEXT,
  p_evolution TEXT,
  p_indications TEXT,
  p_updated_by UUID,
  p_consultation_at TIMESTAMPTZ DEFAULT NULL,
  p_audit_what TEXT DEFAULT 'Modificó consulta clínica (SOAP)',
  p_audit_ip TEXT DEFAULT NULL,
  p_audit_user_agent TEXT DEFAULT NULL,
  p_diagnosis_cie10 TEXT DEFAULT NULL,
  p_diagnoses_json JSONB DEFAULT '[]'::jsonb,
  p_treatments_json JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old clinical_records%ROWTYPE;
  v_new clinical_records%ROWTYPE;
BEGIN
  IF NOT can_write_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_updated_by IS DISTINCT FROM auth.uid() AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_old
  FROM clinical_records
  WHERE id = p_record_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECORD_NOT_FOUND';
  END IF;

  UPDATE clinical_records
  SET
    patient_id = p_patient_id,
    professional_id = p_professional_id,
    appointment_id = p_appointment_id,
    chief_complaint = p_chief_complaint,
    diagnosis = p_diagnosis,
    evolution = p_evolution,
    indications = p_indications,
    diagnosis_cie10 = NULLIF(trim(COALESCE(p_diagnosis_cie10, '')), ''),
    diagnoses_json = COALESCE(p_diagnoses_json, '[]'::jsonb),
    treatments_json = COALESCE(p_treatments_json, '[]'::jsonb),
    created_at = COALESCE(p_consultation_at, created_at),
    updated_by = p_updated_by,
    updated_at = now()
  WHERE id = p_record_id AND clinic_id = p_clinic_id
  RETURNING * INTO v_new;

  PERFORM public.sync_clinical_record_children(
    p_record_id,
    p_clinic_id,
    p_patient_id,
    COALESCE(p_diagnoses_json, '[]'::jsonb),
    COALESCE(p_treatments_json, '[]'::jsonb),
    p_updated_by
  );

  INSERT INTO clinical_record_audit (
    clinical_record_id, clinic_id, patient_id, module, what, action,
    changed_by, old_values, new_values, ip_address, user_agent
  )
  VALUES (
    p_record_id,
    p_clinic_id,
    p_patient_id,
    'clinical',
    p_audit_what,
    'update'::audit_action,
    p_updated_by,
    to_jsonb(v_old),
    to_jsonb(v_new),
    NULLIF(trim(p_audit_ip), '')::inet,
    NULLIF(trim(p_audit_user_agent), '')
  );

  RETURN jsonb_build_object('old', to_jsonb(v_old), 'data', to_jsonb(v_new));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_clinical_record_atomic(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Backfill from Phase 1 JSON (best-effort, idempotent via empty-child guard)
-- ---------------------------------------------------------------------------

INSERT INTO clinical_record_diagnoses (
  clinic_id, patient_id, clinical_record_id, name, cie10_code, pathology_id, is_chronic, sort_order, created_by
)
SELECT
  cr.clinic_id,
  cr.patient_id,
  cr.id,
  NULLIF(trim(COALESCE(elem->>'name', '')), ''),
  NULLIF(trim(COALESCE(elem->>'cie10_code', '')), ''),
  NULLIF(trim(COALESCE(elem->>'pathology_id', '')), '')::uuid,
  COALESCE((elem->>'is_chronic')::boolean, false),
  (ord.ordinality - 1)::integer,
  cr.created_by
FROM clinical_records cr
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cr.diagnoses_json, '[]'::jsonb))
  WITH ORDINALITY AS ord(elem, ordinality)
WHERE jsonb_typeof(COALESCE(cr.diagnoses_json, '[]'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(cr.diagnoses_json, '[]'::jsonb)) > 0
  AND NULLIF(trim(COALESCE(elem->>'name', '')), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clinical_record_diagnoses d
    WHERE d.clinical_record_id = cr.id
  );

INSERT INTO clinical_record_diagnoses (
  clinic_id, patient_id, clinical_record_id, name, cie10_code, is_chronic, sort_order, created_by
)
SELECT
  cr.clinic_id,
  cr.patient_id,
  cr.id,
  COALESCE(NULLIF(trim(cr.diagnosis), ''), cr.diagnosis_cie10),
  NULLIF(trim(cr.diagnosis_cie10), ''),
  false,
  0,
  cr.created_by
FROM clinical_records cr
WHERE NULLIF(trim(COALESCE(cr.diagnosis_cie10, '')), '') IS NOT NULL
  AND (
    cr.diagnoses_json IS NULL
    OR jsonb_typeof(cr.diagnoses_json) <> 'array'
    OR jsonb_array_length(cr.diagnoses_json) = 0
  )
  AND NOT EXISTS (
    SELECT 1 FROM clinical_record_diagnoses d
    WHERE d.clinical_record_id = cr.id
  );

INSERT INTO clinical_record_treatments (
  clinic_id, patient_id, clinical_record_id, product, dose, frequency, notes, status,
  quantity, vademecum_code, catalog_source, active_ingredient, sort_order, created_by
)
SELECT
  cr.clinic_id,
  cr.patient_id,
  cr.id,
  NULLIF(trim(COALESCE(elem->>'product', '')), ''),
  NULLIF(trim(COALESCE(elem->>'dose', '')), ''),
  NULLIF(trim(COALESCE(elem->>'frequency', '')), ''),
  NULLIF(trim(COALESCE(elem->>'notes', '')), ''),
  COALESCE(NULLIF(trim(COALESCE(elem->>'status', '')), ''), 'Actual'),
  CASE
    WHEN jsonb_typeof(elem->'quantity') = 'number' THEN (elem->>'quantity')::numeric
    ELSE NULL
  END,
  NULLIF(trim(COALESCE(elem->>'vademecum_code', '')), ''),
  NULLIF(trim(COALESCE(elem->>'catalog_source', '')), ''),
  NULLIF(trim(COALESCE(elem->>'active_ingredient', '')), ''),
  (ord.ordinality - 1)::integer,
  cr.created_by
FROM clinical_records cr
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cr.treatments_json, '[]'::jsonb))
  WITH ORDINALITY AS ord(elem, ordinality)
WHERE jsonb_typeof(COALESCE(cr.treatments_json, '[]'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(cr.treatments_json, '[]'::jsonb)) > 0
  AND NULLIF(trim(COALESCE(elem->>'product', '')), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clinical_record_treatments t
    WHERE t.clinical_record_id = cr.id
  );

INSERT INTO patient_problem_list (
  clinic_id, patient_id, name, cie10_code, pathology_id, status,
  source_clinical_record_id, source_diagnosis_id, created_by
)
SELECT
  d.clinic_id,
  d.patient_id,
  d.name,
  d.cie10_code,
  d.pathology_id,
  'active',
  d.clinical_record_id,
  d.id,
  d.created_by
FROM (
  SELECT DISTINCT ON (clinic_id, patient_id, cie10_code)
    *
  FROM clinical_record_diagnoses
  WHERE is_chronic = true
    AND cie10_code IS NOT NULL
    AND trim(cie10_code) <> ''
  ORDER BY clinic_id, patient_id, cie10_code, created_at DESC
) d
WHERE NOT EXISTS (
  SELECT 1
  FROM patient_problem_list p
  WHERE p.clinic_id = d.clinic_id
    AND p.patient_id = d.patient_id
    AND p.cie10_code = d.cie10_code
);

-- ---------------------------------------------------------------------------
-- Reporting helpers (CIE-10 / fármaco)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clinic_cie10_occurrence_stats(
  p_clinic_id UUID,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  cie10_code TEXT,
  diagnosis_name TEXT,
  occurrence_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_view_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT
    d.cie10_code,
    MIN(d.name) AS diagnosis_name,
    COUNT(*)::bigint AS occurrence_count
  FROM clinical_record_diagnoses d
  WHERE d.clinic_id = p_clinic_id
    AND d.cie10_code IS NOT NULL
    AND trim(d.cie10_code) <> ''
    AND (p_from IS NULL OR d.created_at >= p_from)
    AND (p_to IS NULL OR d.created_at <= p_to)
  GROUP BY d.cie10_code
  ORDER BY COUNT(*) DESC, d.cie10_code
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
END;
$$;

CREATE OR REPLACE FUNCTION public.clinic_treatment_occurrence_stats(
  p_clinic_id UUID,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  product TEXT,
  active_ingredient TEXT,
  occurrence_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_view_clinical(p_clinic_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT
    t.product,
    MIN(t.active_ingredient) AS active_ingredient,
    COUNT(*)::bigint AS occurrence_count
  FROM clinical_record_treatments t
  WHERE t.clinic_id = p_clinic_id
    AND (p_from IS NULL OR t.created_at >= p_from)
    AND (p_to IS NULL OR t.created_at <= p_to)
  GROUP BY t.product
  ORDER BY COUNT(*) DESC, t.product
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
END;
$$;

GRANT EXECUTE ON FUNCTION public.clinic_cie10_occurrence_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_treatment_occurrence_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
