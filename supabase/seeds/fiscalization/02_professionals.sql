-- Optional: synthetic professionals for fiscalization clinic (STAGING ONLY).
-- Requires a profiles row / auth user already present for user_id — leave user_id null if linking later.

INSERT INTO public.professionals (
  id,
  clinic_id,
  display_name,
  license_number,
  license_national,
  licensing_jurisdiction,
  issuing_authority,
  cuil,
  refeps_identifier,
  refeps_validation_status,
  is_active
)
VALUES
  (
    'c1111111-1111-4111-8111-111111111101',
    'a1111111-1111-4111-8111-111111111111',
    'Dra. Fiscalizacion Valida (FISCALIZACION TEST)',
    'MN-TEST-1001',
    'MN-TEST-1001',
    '02',
    'Autoridad TEST',
    '20123456786',
    'REFEPS-TEST-VALID',
    'sandbox',
    true
  ),
  (
    'c1111111-1111-4111-8111-111111111102',
    'a1111111-1111-4111-8111-111111111111',
    'Dr. Fiscalizacion Invalido (FISCALIZACION TEST)',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'not_configured',
    true
  )
ON CONFLICT (id) DO NOTHING;
