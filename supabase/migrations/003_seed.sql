-- Seed data for development/demo
-- NOTE: Run after creating auth users manually or via Supabase dashboard
-- Replace UUIDs with actual auth.users IDs after signup

-- Example clinic
INSERT INTO clinics (id, name, slug, legal_name, phone, email, address, default_appointment_duration)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Centro Médico Norte',
  'centro-medico-norte',
  'Centro Médico Norte SRL',
  '+54 11 4567-8900',
  'contacto@centromediconorte.demo',
  'Av. Libertador 1234, CABA',
  30
) ON CONFLICT DO NOTHING;

INSERT INTO specialties (clinic_id, name, description) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Clínica Médica', 'Medicina general y preventiva'),
  ('a0000000-0000-4000-8000-000000000001', 'Pediatría', 'Atención infantil'),
  ('a0000000-0000-4000-8000-000000000001', 'Cardiología', 'Enfermedades cardiovasculares')
ON CONFLICT DO NOTHING;

INSERT INTO locations (clinic_id, name, address, phone) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Sede Principal', 'Av. Libertador 1234', '+54 11 4567-8900'),
  ('a0000000-0000-4000-8000-000000000001', 'Sede Norte', 'Av. del Libertador 5678', '+54 11 4567-8901')
ON CONFLICT DO NOTHING;

INSERT INTO consultation_reasons (clinic_id, name) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Control general'),
  ('a0000000-0000-4000-8000-000000000001', 'Consulta por síntomas'),
  ('a0000000-0000-4000-8000-000000000001', 'Estudios y seguimiento'),
  ('a0000000-0000-4000-8000-000000000001', 'Receta / renovación')
ON CONFLICT DO NOTHING;

INSERT INTO clinical_templates (clinic_id, name, chief_complaint_template, diagnosis_template, evolution_template, indications_template) VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'Consulta general',
    'Paciente consulta por: ',
    'Diagnóstico presuntivo: ',
    'Evolución: ',
    'Indicaciones: reposo, hidratación, control en 7 días.'
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'Control pediátrico',
    'Control de niño sano. Motivo: ',
    'Desarrollo dentro de parámetros normales.',
    'Sin signos de alarma.',
    'Continuar alimentación balanceada. Próximo control según calendario.'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public_booking_links (clinic_id, slug, is_active) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'centro-medico-norte-turnos', true)
ON CONFLICT DO NOTHING;

-- Demo patients (no user_id - managed by staff)
INSERT INTO patients (clinic_id, first_name, last_name, document_number, birth_date, phone, email, insurance_provider, insurance_number, allergies, regular_medication) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'María', 'González', '30123456', '1985-03-15', '+54 11 5555-0001', 'maria.gonzalez@email.demo', 'OSDE', '123456789', 'Penicilina', 'Losartán 50mg'),
  ('a0000000-0000-4000-8000-000000000001', 'Carlos', 'Ruiz', '28456789', '1978-11-22', '+54 11 5555-0002', 'carlos.ruiz@email.demo', 'Swiss Medical', '987654321', NULL, NULL),
  ('a0000000-0000-4000-8000-000000000001', 'Lucía', 'Fernández', '45123456', '2018-07-08', '+54 11 5555-0003', 'lucia.fernandez@email.demo', 'Galeno', '456789123', 'Polen', NULL)
ON CONFLICT DO NOTHING;
