/* Base de datos ficticia para pruebas: pacientes, turnos, consultas demo.
   Idempotente. Correr en Supabase SQL Editor despues de 014-016.
   Si falla, usar scripts/supabase-demo-setup.sql (mas simple). */

/* Pacientes demo (Centro Medico Norte) */
INSERT INTO patients (
  clinic_id, first_name, last_name, document_number, birth_date, phone, email,
  address, insurance_provider, insurance_number, allergies, regular_medication,
  medical_history, notes
) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'María', 'González', '30123456', '1985-03-15', '+54 11 5555-0001', 'maria.gonzalez@email.demo', 'Palermo, CABA', 'OSDE', '123456789', 'Penicilina', 'Losartán 50 mg', 'HTA en tratamiento', 'Control cada 6 meses'),
  ('a0000000-0000-4000-8000-000000000001', 'Carlos', 'Ruiz', '28456789', '1978-11-22', '+54 11 5555-0002', 'carlos.ruiz@email.demo', 'Belgrano, CABA', 'Swiss Medical', '987654321', NULL, 'Atorvastatina 20 mg', 'Dislipidemia', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Lucía', 'Fernández', '45123456', '2018-07-08', '+54 11 5555-0003', 'lucia.fernandez@email.demo', 'Villa Urquiza, CABA', 'Galeno', '456789123', 'Polen, ácaros', NULL, 'Asma leve intermitente', 'Paciente pediátrica'),
  ('a0000000-0000-4000-8000-000000000001', 'Elena', 'Morales', '29876543', '1990-05-20', '+54 11 5555-0004', 'elena.morales@email.demo', 'Caballito, CABA', 'OSDE', '223344556', 'AINEs', NULL, 'Migraña sin aura', 'Ideal para probar recetas'),
  ('a0000000-0000-4000-8000-000000000001', 'Roberto', 'Díaz', '32456789', '1965-09-12', '+54 11 5555-0005', 'roberto.diaz@email.demo', 'Flores, CABA', 'IOMA', '778899001', NULL, 'Metformina 850 mg', 'DM2', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Martín', 'Acosta', '35678901', '1995-01-30', '+54 11 5555-0006', 'martin.acosta@email.demo', 'Almagro, CABA', 'Medicus', '334455667', NULL, 'Salbutamol inhalador', 'Asma bronquial', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Sofía', 'Peralta', '41234567', '2016-12-03', '+54 11 5555-0007', 'sofia.peralta@email.demo', 'Colegiales, CABA', 'Omint', '112233445', 'Látex', NULL, 'Dermatitis atópica', 'Pediatría'),
  ('a0000000-0000-4000-8000-000000000001', 'Jorge', 'Huerta', '27123456', '1958-04-18', '+54 11 5555-0008', 'jorge.huerta@email.demo', 'San Telmo, CABA', 'PAMI', '998877665', 'Sulfas', 'Enalapril 10 mg', 'EPOC + cardiopatía', 'Adulto mayor'),
  ('a0000000-0000-4000-8000-000000000001', 'Valentina', 'Romero', '44321098', '2008-08-25', '+54 11 5555-0009', 'valentina.romero@email.demo', 'Nuñez, CABA', 'Galeno', '556677889', NULL, NULL, 'Faringitis recurrente', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Andrés', 'Vega', '31234567', '1988-11-11', '+54 11 5555-0010', 'andres.vega@email.demo', 'Recoleta, CABA', 'Swiss Medical', '667788990', NULL, 'Sertralina 50 mg', 'Trastorno de ansiedad', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Carmen', 'López', '33112233', '1972-06-07', '+54 11 5555-0011', 'carmen.lopez@email.demo', 'Villa Crespo, CABA', 'OSDE', '445566778', NULL, 'Levotiroxina 75 mcg', 'Hipotiroidismo', NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Diego', 'Salinas', '29456780', '1999-02-14', '+54 11 5555-0012', 'diego.salinas@email.demo', 'Barracas, CABA', NULL, NULL, NULL, NULL, 'Sin antecedentes', 'Particular / sin cobertura')
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

-- ─── Turnos de hoy y mañana ─────────────────────────────────────────────────
INSERT INTO appointments (
  clinic_id, patient_id, professional_id, location_id, specialty_id,
  start_at, end_at, status, notes, booking_source
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  pat.id,
  pro.id,
  pro.location_id,
  pro.specialty_id,
  slot.start_at,
  slot.start_at + interval '30 minutes',
  slot.status::appointment_status,
  slot.notes,
  slot.booking_source
FROM (VALUES
  ('30123456', 'b0000000-0000-4000-8000-000000000001', date_trunc('day', now()) + interval '9 hours',  'confirmed'::appointment_status, 'Control HTA', 'manual'),
  ('29876543', 'b0000000-0000-4000-8000-000000000001', date_trunc('day', now()) + interval '10 hours', 'pending'::appointment_status, 'Cefalea / migraña', 'manual'),
  ('28456789', 'b0000000-0000-4000-8000-000000000002', date_trunc('day', now()) + interval '11 hours', 'pending'::appointment_status, 'Control pediátrico', 'manual'),
  ('45123456', 'b0000000-0000-4000-8000-000000000002', date_trunc('day', now()) + interval '12 hours', 'confirmed'::appointment_status, 'Control asma', 'manual'),
  ('32456789', 'b0000000-0000-4000-8000-000000000001', date_trunc('day', now()) + interval '15 hours', 'pending'::appointment_status, 'Control diabetes', 'manual'),
  ('27123456', 'b0000000-0000-4000-8000-000000000003', date_trunc('day', now()) + interval '16 hours', 'pending'::appointment_status, 'ECG control', 'manual'),
  ('31234567', 'b0000000-0000-4000-8000-000000000001', date_trunc('day', now()) + interval '1 day' + interval '9 hours', 'pending'::appointment_status, 'Solicitud online', 'online'),
  ('44321098', 'b0000000-0000-4000-8000-000000000002', date_trunc('day', now()) + interval '1 day' + interval '10 hours', 'pending'::appointment_status, 'Dolor de garganta', 'manual')
) AS slot(doc, pro_id, start_at, status, notes, booking_source)
JOIN patients pat ON pat.document_number = slot.doc AND pat.clinic_id = 'a0000000-0000-4000-8000-000000000001'
JOIN professionals pro ON pro.id = slot.pro_id::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM appointments a
  WHERE a.professional_id = pro.id
    AND a.start_at = slot.start_at
    AND a.status NOT IN ('cancelled'::appointment_status)
);

-- ─── Consultas demo (para probar recetas sin crear desde cero) ───────────────
INSERT INTO clinical_records (
  clinic_id, patient_id, professional_id, chief_complaint, diagnosis, evolution,
  indications, created_by
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  pat.id,
  'b0000000-0000-4000-8000-000000000001'::uuid,
  'Cefalea pulsátil hemicraneal derecha, 24 hs de evolución',
  'Migraña sin aura (G43.0)',
  'Paciente refiere fotofobia y náuseas. Sin signos de alarma neurológica.',
  'Reposo en ambiente oscuro. Hidratación. Control si empeora.',
  COALESCE(
    (SELECT cm.user_id FROM clinic_members cm
     WHERE cm.clinic_id = 'a0000000-0000-4000-8000-000000000001'
       AND cm.role IN ('doctor', 'clinic_admin') AND cm.is_active = true
     LIMIT 1),
    (SELECT id FROM profiles LIMIT 1)
  )
FROM patients pat
WHERE pat.clinic_id = 'a0000000-0000-4000-8000-000000000001'
  AND pat.document_number = '29876543'
  AND NOT EXISTS (
    SELECT 1 FROM clinical_records cr
    WHERE cr.patient_id = pat.id
      AND cr.diagnosis ILIKE '%Migraña%'
  );

INSERT INTO clinical_records (
  clinic_id, patient_id, professional_id, chief_complaint, diagnosis, evolution,
  indications, created_by
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  pat.id,
  'b0000000-0000-4000-8000-000000000001'::uuid,
  'Control de hipertensión arterial',
  'Hipertensión arterial esencial (I10)',
  'PA 135/85 en consultorio. Adherencia al tratamiento.',
  'Continuar Losartán. Dieta hiposódica. Control en 3 meses.',
  COALESCE(
    (SELECT cm.user_id FROM clinic_members cm
     WHERE cm.clinic_id = 'a0000000-0000-4000-8000-000000000001'
       AND cm.role IN ('doctor', 'clinic_admin') AND cm.is_active = true
     LIMIT 1),
    (SELECT id FROM profiles LIMIT 1)
  )
FROM patients pat
WHERE pat.clinic_id = 'a0000000-0000-4000-8000-000000000001'
  AND pat.document_number = '30123456'
  AND NOT EXISTS (
    SELECT 1 FROM clinical_records cr
    WHERE cr.patient_id = pat.id
      AND cr.diagnosis ILIKE '%Hipertensión%'
  );

-- ─── Copiar pacientes demo a TU clínica (cambiá el email) ─────────────────
CREATE OR REPLACE FUNCTION public.seed_demo_patients_for_clinic(p_clinic_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_pro_id UUID;
  v_user_id UUID;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'CLINIC_NOT_FOUND';
  END IF;

  INSERT INTO patients (
    clinic_id, first_name, last_name, document_number, birth_date, phone, email,
    insurance_provider, insurance_number, allergies, regular_medication, medical_history, notes
  )
  SELECT
    p_clinic_id, first_name, last_name, document_number, birth_date, phone, email,
    insurance_provider, insurance_number, allergies, regular_medication, medical_history, notes
  FROM patients
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'
  ON CONFLICT (clinic_id, document_number) DO UPDATE SET
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    insurance_provider = EXCLUDED.insurance_provider,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

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
      date_trunc('day', now()) + interval '10 hours',
      date_trunc('day', now()) + interval '10 hours 30 minutes',
      'pending'::appointment_status,
      'Turno demo — probar Empezar consulta',
      'manual'
    FROM patients p
    WHERE p.clinic_id = p_clinic_id
      AND p.document_number = '29876543'
      AND NOT EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.patient_id = p.id
          AND a.start_at::date = current_date
          AND a.status NOT IN ('cancelled'::appointment_status)
      );
  END IF;

  RETURN jsonb_build_object(
    'clinic_id', p_clinic_id,
    'patients_upserted', v_count,
    'demo_professional_used', v_pro_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_patients_for_clinic TO authenticated;

-- Ejemplo: copiar demo a tu clínica por email de usuario
-- SELECT seed_demo_patients_for_clinic(
--   (SELECT cm.clinic_id FROM clinic_members cm
--    JOIN profiles p ON p.id = cm.user_id
--    WHERE p.email = 'tu@email.com' AND cm.is_active = true
--    LIMIT 1)
-- );
