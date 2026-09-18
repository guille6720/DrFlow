-- Fiscalization synthetic seed (STAGING ONLY).
-- Does NOT create auth.users (use Dashboard invite + MFA).
-- Does NOT use real PHI. All identifiers are test-only.
--
-- Prerequisites:
-- 1. Migration 142 applied (clinics.is_fiscalization).
-- 2. Run against staging project gprmsufvhabntbrytwyi only.
-- 3. Provision auth users separately; map membership roles as documented in README.md.
--
-- Fixed UUIDs for reproducible fiscalization scenarios.

-- Clinic (isolated)
INSERT INTO public.clinics (
  id, name, slug, timezone, is_active, is_fiscalization, practice_profile, refeps_enabled
)
VALUES (
  'a1111111-1111-4111-8111-111111111111',
  'DrFlow Fiscalización (TEST)',
  'fiscalizacion-test',
  'America/Argentina/Buenos_Aires',
  true,
  true,
  'fiscalizacion_test',
  true
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  is_fiscalization = true,
  practice_profile = 'fiscalizacion_test',
  updated_at = now();

-- Patients (synthetic)
INSERT INTO public.patients (
  id, clinic_id, first_name, last_name, document_number, document_type,
  cuil, birth_date, sex, alt_identifier_type, alt_identifier_value, address, insurance_provider
)
VALUES
  (
    'b1111111-1111-4111-8111-111111111101',
    'a1111111-1111-4111-8111-111111111111',
    'Paciente',
    'Fiscalizacion Valido',
    '90000001',
    'dni',
    '20123456786',
    '1990-01-15',
    'F',
    NULL,
    NULL,
    'Calle Test 100',
    'OSDE TEST'
  ),
  (
    'b1111111-1111-4111-8111-111111111102',
    'a1111111-1111-4111-8111-111111111111',
    'Paciente',
    'Sin Cuil',
    '90000002',
    'dni',
    NULL,
    '1985-06-01',
    'M',
    NULL,
    NULL,
    NULL,
    'PARTICULAR'
  ),
  (
    'b1111111-1111-4111-8111-111111111103',
    'a1111111-1111-4111-8111-111111111111',
    'Foreign',
    'Passport Test',
    'X9000003',
    'passport',
    NULL,
    '1992-03-20',
    'X',
    'passport',
    'P-TEST-90003',
    'Av Test 200',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.patients IS
  'Clinical patients. Fiscalization seed rows use TEST-only identifiers (document 90xxxxxx / synthetic CUIL checksum).';
