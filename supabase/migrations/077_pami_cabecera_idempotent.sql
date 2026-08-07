-- Idempotent PAMI cabecera seed: advisory lock, unique templates, explicit changed flag.

-- Prevent duplicate clinical_templates per clinic (race-safe with ON CONFLICT).
WITH dups AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY clinic_id, lower(trim(name))
      ORDER BY created_at, id
    ) AS rn
  FROM clinical_templates
)
UPDATE clinical_templates t
SET name = trim(t.name) || ' (' || substr(t.id::text, 1, 8) || ')'
FROM dups d
WHERE t.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinical_templates_clinic_name
  ON clinical_templates (clinic_id, lower(trim(name)));

CREATE OR REPLACE FUNCTION public.seed_pami_cabecera_for_clinic(p_clinic_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_templates INTEGER := 0;
  v_reasons INTEGER := 0;
  v_specialty_updates INTEGER := 0;
  v_prev_profile TEXT;
  v_templates_present INTEGER := 0;
  v_reasons_present INTEGER := 0;
  v_template_names TEXT[] := ARRAY[
    'Control HTA — PAMI',
    'Control DM2 — PAMI',
    'Renovación medicación crónica',
    'Consulta aguda respiratoria',
    'Control EPOC / asma'
  ];
  v_reason_names TEXT[] := ARRAY[
    'Control crónico PAMI',
    'Consulta aguda',
    'Renovación medicación',
    'Pedido de estudios',
    'Derivación especialista',
    'Certificado / reposo'
  ];
  v_already_configured BOOLEAN := false;
  v_changed BOOLEAN := false;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  IF v_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clinic_members cm
    WHERE cm.clinic_id = p_clinic_id AND cm.user_id = v_user_id
      AND cm.is_active = true AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
  ) AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = v_user_id AND p.is_superadmin = true
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Serialize concurrent seeds for the same clinic (double-submit / multi-tab).
  PERFORM pg_advisory_xact_lock(hashtext('seed_pami_cabecera_for_clinic'), hashtext(p_clinic_id::text));

  SELECT practice_profile
  INTO v_prev_profile
  FROM clinics
  WHERE id = p_clinic_id;

  SELECT COUNT(*)::INTEGER
  INTO v_templates_present
  FROM clinical_templates ct
  WHERE ct.clinic_id = p_clinic_id
    AND ct.name = ANY (v_template_names);

  SELECT COUNT(*)::INTEGER
  INTO v_reasons_present
  FROM consultation_reasons cr
  WHERE cr.clinic_id = p_clinic_id
    AND cr.name = ANY (v_reason_names);

  v_already_configured :=
    v_prev_profile = 'cabecera_pami'
    AND v_templates_present >= cardinality(v_template_names)
    AND v_reasons_present >= cardinality(v_reason_names);

  UPDATE clinics SET
    default_insurance_provider = 'PAMI',
    practice_profile = 'cabecera_pami',
    default_appointment_duration = 20,
    accepted_coverages = CASE
      WHEN accepted_coverages IS NULL OR cardinality(accepted_coverages) = 0 THEN ARRAY['PAMI']::TEXT[]
      WHEN NOT ('PAMI' = ANY (accepted_coverages)) THEN accepted_coverages || ARRAY['PAMI']::TEXT[]
      ELSE accepted_coverages
    END
  WHERE id = p_clinic_id;

  INSERT INTO consultation_reasons (clinic_id, name)
  SELECT p_clinic_id, r.name
  FROM unnest(v_reason_names) AS r(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM consultation_reasons cr
    WHERE cr.clinic_id = p_clinic_id AND lower(trim(cr.name)) = lower(trim(r.name))
  );

  GET DIAGNOSTICS v_reasons = ROW_COUNT;

  INSERT INTO clinical_templates (
    clinic_id, name, chief_complaint_template, diagnosis_template,
    evolution_template, indications_template
  )
  SELECT p_clinic_id, t.name, t.chief, t.diag, t.evo, t.ind
  FROM (VALUES
    ('Control HTA — PAMI',
     'Control de hipertensión arterial. Refiere adherencia parcial al tratamiento.',
     'Hipertensión arterial esencial (I10)',
     'PA en consultorio. Sin signos de alarma.',
     'Continuar tratamiento. Dieta hiposódica. Control en 30 días.'),
    ('Control DM2 — PAMI',
     'Control de diabetes mellitus tipo 2.',
     'Diabetes mellitus tipo 2 (E11.9)',
     'Controles domiciliarios variables.',
     'Continuar tratamiento. Laboratorio: glucemia, HbA1c, perfil renal.'),
    ('Renovación medicación crónica',
     'Solicita renovación de medicación de uso crónico.',
     'Enfermedades crónicas en tratamiento — cabecera PAMI',
     'Paciente estable. Adherencia aceptable.',
     'Renovar medicación 30 días. Control según cronograma PAMI.'),
    ('Consulta aguda respiratoria',
     'Cuadro respiratorio de evolución aguda.',
     'Infección respiratoria aguda (J06.9)',
     'Sin signos de gravedad en consultorio.',
     'Sintomáticos. Control 48-72 hs si empeora.'),
    ('Control EPOC / asma',
     'Control de enfermedad respiratoria crónica.',
     'EPOC (J44.9) / Asma (J45.9)',
     'Disnea estable. Uso de broncodilatador según necesidad.',
     'Continuar inhaladores. Vacunas al día. Control 60 días.')
  ) AS t(name, chief, diag, evo, ind)
  WHERE NOT EXISTS (
    SELECT 1 FROM clinical_templates ct
    WHERE ct.clinic_id = p_clinic_id AND lower(trim(ct.name)) = lower(trim(t.name))
  );

  GET DIAGNOSTICS v_templates = ROW_COUNT;

  UPDATE specialties SET name = 'Medicina General / PAMI'
  WHERE clinic_id = p_clinic_id AND name = 'Medicina general';

  GET DIAGNOSTICS v_specialty_updates = ROW_COUNT;

  v_changed :=
    v_templates > 0
    OR v_reasons > 0
    OR v_specialty_updates > 0
    OR coalesce(v_prev_profile, '') IS DISTINCT FROM 'cabecera_pami';

  RETURN jsonb_build_object(
    'clinic_id', p_clinic_id,
    'already_configured', v_already_configured,
    'changed', v_changed,
    'templates_added', v_templates,
    'reasons_added', v_reasons,
    'templates_present', v_templates_present + v_templates,
    'reasons_present', v_reasons_present + v_reasons,
    'default_insurance', 'PAMI',
    'slot_minutes', 20
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_pami_cabecera_for_clinic(UUID) TO authenticated;

COMMENT ON FUNCTION public.seed_pami_cabecera_for_clinic(UUID) IS
  'Idempotent PAMI cabecera setup: profile, templates, reasons, coverages. Safe to run multiple times.';
