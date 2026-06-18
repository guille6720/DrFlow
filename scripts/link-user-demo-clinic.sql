-- Vinculá tu usuario a la clínica demo (Centro Médico Norte) O cargá demo en tu clínica

-- OPCIÓN A — Desde la app (recomendado):
-- Configuración → "Cargar pacientes demo" (requiere migraciones 017 y 019)

-- OPCIÓN B — Vincular a Centro Médico Norte (datos ya precargados):
-- Reemplazá el email y ejecutá en Supabase SQL Editor:

INSERT INTO clinic_members (clinic_id, user_id, role, is_active)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  p.id,
  'clinic_admin',
  true
FROM profiles p
WHERE p.email = 'tu@email.com'
ON CONFLICT (clinic_id, user_id) DO UPDATE SET role = 'clinic_admin', is_active = true;

-- OPCIÓN C — Copiar demo a TU clínica por SQL:
-- SELECT seed_demo_patients_for_clinic(
--   (SELECT cm.clinic_id FROM clinic_members cm
--    JOIN profiles p ON p.id = cm.user_id
--    WHERE p.email = 'tu@email.com' AND cm.is_active = true
--    ORDER BY cm.created_at DESC
--    LIMIT 1)
-- );
