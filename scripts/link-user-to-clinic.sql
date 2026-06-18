-- Vincular usuario existente a clínica DrGuille (slug: drflow)
-- Ejecutar en Supabase → SQL Editor (como postgres / service role).
-- Reemplazá el email si no es el tuyo.

-- ── 1) Diagnóstico ──────────────────────────────────────────────
SELECT id, email, created_at
FROM auth.users
WHERE email ILIKE '%castro%'
ORDER BY created_at DESC;

SELECT id, name, slug, email FROM clinics WHERE slug = 'drflow';

SELECT cm.*, p.email, p.full_name
FROM clinic_members cm
JOIN profiles p ON p.id = cm.user_id
WHERE cm.clinic_id = (SELECT id FROM clinics WHERE slug = 'drflow' LIMIT 1);

-- ── 2) Vinculación completa (idempotente) ───────────────────────
-- Columna que agrega la migración 004 (si no la ejecutaste aún)
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS display_name TEXT;

DO $$
DECLARE
  v_email text := 'g.a.castro.hm@gmail.com';  -- ← CAMBIÁ por tu email
  v_user_id uuid;
  v_clinic_id uuid;
  v_spec_id uuid;
  v_loc_id uuid;
  v_pro_id uuid;
  v_name text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado con email: %', v_email;
  END IF;

  SELECT id INTO v_clinic_id FROM clinics WHERE slug = 'drflow';

  IF v_clinic_id IS NULL THEN
    INSERT INTO clinics (name, slug, email, phone)
    VALUES ('DrGuille', 'drflow', v_email, NULL)
    RETURNING id INTO v_clinic_id;
  ELSE
    UPDATE clinics SET name = 'DrGuille', email = COALESCE(email, v_email) WHERE id = v_clinic_id;
  END IF;

  INSERT INTO profiles (id, email, full_name)
  SELECT v_user_id, v_email, COALESCE(raw_user_meta_data->>'full_name', 'Guillermo Castro')
  FROM auth.users WHERE id = v_user_id
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  SELECT COALESCE(full_name, 'Guillermo Castro') INTO v_name FROM profiles WHERE id = v_user_id;

  INSERT INTO clinic_members (clinic_id, user_id, role, is_active)
  VALUES (v_clinic_id, v_user_id, 'clinic_admin', true)
  ON CONFLICT (clinic_id, user_id) DO UPDATE SET role = 'clinic_admin', is_active = true;

  INSERT INTO specialties (clinic_id, name)
  SELECT v_clinic_id, 'Medicina general'
  WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE clinic_id = v_clinic_id);
  SELECT id INTO v_spec_id FROM specialties WHERE clinic_id = v_clinic_id LIMIT 1;

  INSERT INTO locations (clinic_id, name)
  SELECT v_clinic_id, 'Consultorio principal'
  WHERE NOT EXISTS (SELECT 1 FROM locations WHERE clinic_id = v_clinic_id);
  SELECT id INTO v_loc_id FROM locations WHERE clinic_id = v_clinic_id LIMIT 1;

  INSERT INTO professionals (clinic_id, user_id, specialty_id, location_id, display_name, is_active)
  SELECT v_clinic_id, v_user_id, v_spec_id, v_loc_id, v_name, true
  WHERE NOT EXISTS (
    SELECT 1 FROM professionals WHERE clinic_id = v_clinic_id AND user_id = v_user_id
  )
  RETURNING id INTO v_pro_id;

  IF v_pro_id IS NULL THEN
    SELECT id INTO v_pro_id FROM professionals WHERE clinic_id = v_clinic_id AND user_id = v_user_id LIMIT 1;
  END IF;

  INSERT INTO public_booking_links (clinic_id, slug, professional_id, is_active)
  VALUES (v_clinic_id, 'drflow', v_pro_id, true)
  ON CONFLICT (slug) DO UPDATE SET is_active = true, professional_id = EXCLUDED.professional_id;

  INSERT INTO availability_rules (professional_id, clinic_id, day_of_week, start_time, end_time, slot_duration, location_id)
  SELECT v_pro_id, v_clinic_id, d, '09:00'::time, '18:00'::time, 30, v_loc_id
  FROM generate_series(1, 5) AS d
  WHERE NOT EXISTS (
    SELECT 1 FROM availability_rules WHERE professional_id = v_pro_id AND day_of_week = d
  );

  INSERT INTO consultation_reasons (clinic_id, name)
  SELECT v_clinic_id, unnest(ARRAY['Consulta general', 'Control'])
  WHERE NOT EXISTS (SELECT 1 FROM consultation_reasons WHERE clinic_id = v_clinic_id);

  RAISE NOTICE 'Listo: user % → clínica % (%)', v_user_id, v_clinic_id, 'drflow';
END $$;

-- ── 3) Verificar ────────────────────────────────────────────────
SELECT c.name, c.slug, p.email, p.full_name, cm.role
FROM clinic_members cm
JOIN clinics c ON c.id = cm.clinic_id
JOIN profiles p ON p.id = cm.user_id
WHERE c.slug = 'drflow';
