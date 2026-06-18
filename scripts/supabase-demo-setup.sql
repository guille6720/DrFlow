/* DrFlow: ejecutar TODO este archivo en Supabase SQL Editor (Run).
   Paso 2: en la app ir a Configuracion y pulsar "Cargar pacientes demo".
   O descomentar y cambiar el email al final de este archivo. */

INSERT INTO patients (
  clinic_id, first_name, last_name, document_number, birth_date, phone, email,
  address, insurance_provider, insurance_number, allergies, regular_medication,
  medical_history, notes
) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Maria', 'Gonzalez', '30123456', '1985-03-15', '+54 11 5555-0001', 'maria.gonzalez@email.demo', 'Palermo, CABA', 'OSDE', '123456789', 'Penicilina', 'Losartan 50 mg', 'HTA en tratamiento', 'Control cada 6 meses'),
  ('a0000000-0000-4000-8000-000000000001', 'Carlos', 'Ruiz', '28456789', '1978-11-22', '+54 11 5555-0002', 'carlos.ruiz@email.demo', 'Belgrano, CABA', 'Swiss Medical', '987654321', NULL, 'Atorvastatina 20 mg', 'Dislipidemia', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Lucia', 'Fernandez', '45123456', '2018-07-08', '+54 11 5555-0003', 'lucia.fernandez@email.demo', 'Villa Urquiza, CABA', 'Galeno', '456789123', 'Polen', NULL, 'Asma leve intermitente', 'Paciente pediatrica'),
  ('a0000000-0000-4000-8000-000000000001', 'Elena', 'Morales', '29876543', '1990-05-20', '+54 11 5555-0004', 'elena.morales@email.demo', 'Caballito, CABA', 'OSDE', '223344556', 'AINEs', NULL, 'Migraña sin aura', 'Ideal para probar recetas'),
  ('a0000000-0000-4000-8000-000000000001', 'Roberto', 'Diaz', '32456789', '1965-09-12', '+54 11 5555-0005', 'roberto.diaz@email.demo', 'Flores, CABA', 'IOMA', '778899001', NULL, 'Metformina 850 mg', 'DM2', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Martin', 'Acosta', '35678901', '1995-01-30', '+54 11 5555-0006', 'martin.acosta@email.demo', 'Almagro, CABA', 'Medicus', '334455667', NULL, 'Salbutamol inhalador', 'Asma bronquial', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Sofia', 'Peralta', '41234567', '2016-12-03', '+54 11 5555-0007', 'sofia.peralta@email.demo', 'Colegiales, CABA', 'Omint', '112233445', 'Latex', NULL, 'Dermatitis atopica', 'Pediatria'),
  ('a0000000-0000-4000-8000-000000000001', 'Jorge', 'Huerta', '27123456', '1958-04-18', '+54 11 5555-0008', 'jorge.huerta@email.demo', 'San Telmo, CABA', 'PAMI', '998877665', 'Sulfas', 'Enalapril 10 mg', 'EPOC + cardiopatia', 'Adulto mayor'),
  ('a0000000-0000-4000-8000-000000000001', 'Valentina', 'Romero', '44321098', '2008-08-25', '+54 11 5555-0009', 'valentina.romero@email.demo', 'Nunez, CABA', 'Galeno', '556677889', NULL, NULL, 'Faringitis recurrente', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Andres', 'Vega', '31234567', '1988-11-11', '+54 11 5555-0010', 'andres.vega@email.demo', 'Recoleta, CABA', 'Swiss Medical', '667788990', NULL, 'Sertralina 50 mg', 'Trastorno de ansiedad', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Carmen', 'Lopez', '33112233', '1972-06-07', '+54 11 5555-0011', 'carmen.lopez@email.demo', 'Villa Crespo, CABA', 'OSDE', '445566778', NULL, 'Levotiroxina 75 mcg', 'Hipotiroidismo', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Diego', 'Salinas', '29456780', '1999-02-14', '+54 11 5555-0012', 'diego.salinas@email.demo', 'Barracas, CABA', NULL, NULL, NULL, NULL, 'Sin antecedentes', 'Particular')
ON CONFLICT (clinic_id, document_number) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  updated_at = now();

INSERT INTO clinical_records (
  clinic_id, patient_id, professional_id, chief_complaint, diagnosis, evolution,
  indications, created_by
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  pat.id,
  (SELECT id FROM professionals WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001' LIMIT 1),
  'Cefalea pulsátil hemicraneal derecha, 24 hs de evolucion',
  'Migraña sin aura (G43.0)',
  'Paciente refiere fotofobia y nauseas.',
  'Reposo. Hidratacion.',
  (SELECT id FROM profiles LIMIT 1)
FROM patients pat
WHERE pat.clinic_id = 'a0000000-0000-4000-8000-000000000001'
  AND pat.document_number = '29876543'
  AND EXISTS (SELECT 1 FROM professionals WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001')
  AND NOT EXISTS (
    SELECT 1 FROM clinical_records cr
    WHERE cr.patient_id = pat.id AND cr.diagnosis ILIKE '%Migra%'
  );

INSERT INTO clinical_records (
  clinic_id, patient_id, professional_id, chief_complaint, diagnosis, evolution,
  indications, created_by
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  pat.id,
  (SELECT id FROM professionals WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001' LIMIT 1),
  'Control de hipertension arterial',
  'Hipertension arterial esencial (I10)',
  'PA 135/85 en consultorio.',
  'Continuar Losartan.',
  (SELECT id FROM profiles LIMIT 1)
FROM patients pat
WHERE pat.clinic_id = 'a0000000-0000-4000-8000-000000000001'
  AND pat.document_number = '30123456'
  AND EXISTS (SELECT 1 FROM professionals WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001')
  AND NOT EXISTS (
    SELECT 1 FROM clinical_records cr
    WHERE cr.patient_id = pat.id AND cr.diagnosis ILIKE '%Hipertens%'
  );

CREATE OR REPLACE FUNCTION public.seed_demo_patients_for_clinic(p_clinic_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo_clinic UUID := 'a0000000-0000-4000-8000-000000000001';
  v_patients INTEGER := 0;
  v_records INTEGER := 0;
  v_appointments INTEGER := 0;
  v_pro_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM clinic_members cm
    WHERE cm.clinic_id = p_clinic_id
      AND cm.user_id = v_user_id
      AND cm.is_active = true
      AND cm.role IN ('clinic_admin', 'doctor', 'secretary')
  ) AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = v_user_id AND p.is_superadmin = true
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO patients (
    clinic_id, first_name, last_name, document_number, birth_date, phone, email,
    insurance_provider, insurance_number, allergies, regular_medication, medical_history, notes
  )
  SELECT
    p_clinic_id, first_name, last_name, document_number, birth_date, phone, email,
    insurance_provider, insurance_number, allergies, regular_medication, medical_history, notes
  FROM patients
  WHERE clinic_id = v_demo_clinic
  ON CONFLICT (clinic_id, document_number) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    insurance_provider = EXCLUDED.insurance_provider,
    allergies = EXCLUDED.allergies,
    regular_medication = EXCLUDED.regular_medication,
    medical_history = EXCLUDED.medical_history,
    notes = EXCLUDED.notes,
    updated_at = now();

  GET DIAGNOSTICS v_patients = ROW_COUNT;

  SELECT id INTO v_pro_id
  FROM professionals
  WHERE clinic_id = p_clinic_id AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_pro_id IS NOT NULL THEN
    INSERT INTO appointments (
      clinic_id, patient_id, professional_id, start_at, end_at, status, notes, booking_source
    )
    SELECT
      p_clinic_id,
      p.id,
      v_pro_id,
      slot.start_at,
      slot.start_at + interval '30 minutes',
      slot.status::appointment_status,
      slot.notes,
      slot.booking_source
    FROM (VALUES
      ('30123456', date_trunc('day', now()) + interval '9 hours',  'confirmed'::appointment_status, 'Control HTA', 'manual'),
      ('29876543', date_trunc('day', now()) + interval '10 hours', 'pending'::appointment_status, 'Cefalea / migraña', 'manual'),
      ('45123456', date_trunc('day', now()) + interval '11 hours', 'pending'::appointment_status, 'Control pediatrico', 'manual'),
      ('32456789', date_trunc('day', now()) + interval '15 hours', 'pending'::appointment_status, 'Control diabetes', 'manual')
    ) AS slot(doc, start_at, status, notes, booking_source)
    JOIN patients p ON p.document_number = slot.doc AND p.clinic_id = p_clinic_id
    WHERE NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.patient_id = p.id
        AND a.start_at = slot.start_at
        AND a.status NOT IN ('cancelled'::appointment_status)
    );

    GET DIAGNOSTICS v_appointments = ROW_COUNT;
  END IF;

  IF v_pro_id IS NOT NULL THEN
    INSERT INTO clinical_records (
      clinic_id, patient_id, professional_id, chief_complaint, diagnosis, evolution,
      indications, created_by
    )
    SELECT
      p_clinic_id,
      p_target.id,
      v_pro_id,
      cr.chief_complaint,
      cr.diagnosis,
      cr.evolution,
      cr.indications,
      v_user_id
    FROM clinical_records cr
    JOIN patients p_source ON p_source.id = cr.patient_id AND p_source.clinic_id = v_demo_clinic
    JOIN patients p_target
      ON p_target.clinic_id = p_clinic_id
      AND p_target.document_number = p_source.document_number
    WHERE cr.clinic_id = v_demo_clinic
      AND NOT EXISTS (
        SELECT 1 FROM clinical_records existing
        WHERE existing.patient_id = p_target.id
          AND existing.diagnosis IS NOT DISTINCT FROM cr.diagnosis
      );

    GET DIAGNOSTICS v_records = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', p_clinic_id,
    'patients_upserted', v_patients,
    'clinical_records', v_records,
    'appointments', v_appointments,
    'demo_professional_used', v_pro_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_patients_for_clinic(UUID) TO authenticated;

/* Listo. Ahora en la app: Configuracion -> "Cargar pacientes demo" */
/* Tambien ejecutar: supabase/migrations/020_pami_cabecera.sql */
