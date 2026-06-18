/* PAMI medico de cabecera: plantillas, turnos 20 min, perfil clinico */

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS default_insurance_provider TEXT,
  ADD COLUMN IF NOT EXISTS practice_profile TEXT;

ALTER TABLE medical_orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'study';

DO $$ BEGIN
  ALTER TABLE medical_orders
    ADD CONSTRAINT medical_orders_order_type_check
    CHECK (order_type IN ('study', 'referral'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
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

  UPDATE clinics SET
    default_insurance_provider = 'PAMI',
    practice_profile = 'cabecera_pami',
    default_appointment_duration = 20
  WHERE id = p_clinic_id;

  INSERT INTO consultation_reasons (clinic_id, name)
  SELECT p_clinic_id, r.name
  FROM (VALUES
    ('Control crónico PAMI'),
    ('Consulta aguda'),
    ('Renovación medicación'),
    ('Pedido de estudios'),
    ('Derivación especialista'),
    ('Certificado / reposo')
  ) AS r(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM consultation_reasons cr
    WHERE cr.clinic_id = p_clinic_id AND cr.name = r.name
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
    WHERE ct.clinic_id = p_clinic_id AND ct.name = t.name
  );

  GET DIAGNOSTICS v_templates = ROW_COUNT;

  UPDATE specialties SET name = 'Medicina General / PAMI'
  WHERE clinic_id = p_clinic_id AND name = 'Medicina general';

  RETURN jsonb_build_object(
    'clinic_id', p_clinic_id,
    'templates_added', v_templates,
    'reasons_added', v_reasons,
    'default_insurance', 'PAMI',
    'slot_minutes', 20
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_pami_cabecera_for_clinic(UUID) TO authenticated;
