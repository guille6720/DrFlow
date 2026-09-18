-- Geriatrics domain schema (additive, multi-tenant via clinic_id).
-- Staging-first. No destructive changes. Does not alter patients / clinical_records.
-- Resident identity reuses public.patients via patient_id FK.

-- ---------------------------------------------------------------------------
-- Rooms & beds
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  floor TEXT,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT geriatrics_rooms_clinic_code UNIQUE (clinic_id, code)
);

CREATE TABLE IF NOT EXISTS public.geriatrics_beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.geriatrics_rooms(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'libre'
    CHECK (status IN ('libre', 'ocupada', 'reservada', 'mantenimiento', 'bloqueada')),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT geriatrics_beds_clinic_room_code UNIQUE (clinic_id, room_id, code)
);

CREATE INDEX IF NOT EXISTS idx_geri_beds_clinic_status
  ON public.geriatrics_beds (clinic_id, status);

-- ---------------------------------------------------------------------------
-- Residents (extension of patients — no duplicate identity)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'activo'
    CHECK (status IN ('activo', 'hospitalizado_temporal', 'ausencia_temporal', 'egresado', 'fallecido')),
  admission_date DATE,
  discharge_date DATE,
  bed_id UUID REFERENCES public.geriatrics_beds(id) ON DELETE SET NULL,
  dependency_level TEXT,
  mobility TEXT,
  diet TEXT,
  allergies TEXT,
  coverage TEXT,
  primary_contact_name TEXT,
  primary_contact_phone TEXT,
  legal_guardian_name TEXT,
  legal_guardian_phone TEXT,
  responsible_professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  observations TEXT,
  restrictions TEXT,
  clinical_alerts TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT geriatrics_residents_clinic_patient UNIQUE (clinic_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_geri_residents_clinic_status
  ON public.geriatrics_residents (clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_geri_residents_bed
  ON public.geriatrics_residents (clinic_id, bed_id)
  WHERE bed_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.geriatrics_resident_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.geriatrics_bed_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  bed_id UUID NOT NULL REFERENCES public.geriatrics_beds(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_geri_bed_assign_active
  ON public.geriatrics_bed_assignments (clinic_id, bed_id)
  WHERE released_at IS NULL;

-- ---------------------------------------------------------------------------
-- Nursing (append-only clinical notes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_nursing_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT geriatrics_nursing_shifts_unique UNIQUE (clinic_id, key)
);

INSERT INTO public.geriatrics_nursing_shifts (clinic_id, key, label, sort_order)
SELECT c.id, s.key, s.label, s.sort_order
FROM public.clinics c
CROSS JOIN (VALUES
  ('manana', 'Mañana', 1),
  ('tarde', 'Tarde', 2),
  ('noche', 'Noche', 3)
) AS s(key, label, sort_order)
ON CONFLICT (clinic_id, key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.geriatrics_nursing_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  shift_key TEXT NOT NULL DEFAULT 'manana',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  temperature NUMERIC(4,1),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  spo2 INTEGER,
  glucose NUMERIC(6,2),
  weight_kg NUMERIC(6,2),
  pain_score INTEGER CHECK (pain_score IS NULL OR (pain_score BETWEEN 0 AND 10)),
  general_status TEXT,
  hygiene TEXT,
  mobility TEXT,
  elimination TEXT,
  intake TEXT,
  hydration TEXT,
  rest TEXT,
  postural_changes TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  correction_of_id UUID REFERENCES public.geriatrics_nursing_notes(id) ON DELETE SET NULL,
  is_correction BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_geri_nursing_resident_time
  ON public.geriatrics_nursing_notes (clinic_id, resident_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Medication (eMAR)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_medication_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dose TEXT,
  route TEXT,
  frequency TEXT,
  schedule_times TEXT[] NOT NULL DEFAULT '{}',
  starts_on DATE,
  ends_on DATE,
  prescriber_professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  indications TEXT,
  status TEXT NOT NULL DEFAULT 'activo'
    CHECK (status IN ('activo', 'suspendido', 'finalizado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geriatrics_medication_administrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.geriatrics_medication_orders(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'administrada', 'omitida', 'rechazada', 'suspendida', 'fuera_de_horario')),
  administered_at TIMESTAMPTZ,
  administered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  correction_of_id UUID REFERENCES public.geriatrics_medication_administrations(id) ON DELETE SET NULL,
  is_correction BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_geri_med_admin_pending
  ON public.geriatrics_medication_administrations (clinic_id, status, scheduled_at)
  WHERE status = 'pendiente';

-- ---------------------------------------------------------------------------
-- Care plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Plan de cuidados',
  review_date DATE,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'archivado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geriatrics_care_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  care_plan_id UUID NOT NULL REFERENCES public.geriatrics_care_plans(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  frequency TEXT,
  responsible TEXT,
  objective TEXT,
  observations TEXT,
  review_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Assessment engine (extensible scales — no protected questionnaire text seeded)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_assessment_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  license_note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.geriatrics_assessment_definitions (key, name, description, license_note, schema_json)
VALUES
  (
    'barthel_placeholder',
    'Barthel (preparado)',
    'Motor de evaluación listo. Cuestionario textual pendiente de verificación de licencia/uso.',
    'No incluir ítems textuales hasta confirmar derechos de uso.',
    '{"version":1,"items":[],"scoring":"pending_license_review"}'::jsonb
  ),
  (
    'katz_placeholder',
    'Katz (preparado)',
    'Motor de evaluación listo. Cuestionario textual pendiente de verificación de licencia/uso.',
    'No incluir ítems textuales hasta confirmar derechos de uso.',
    '{"version":1,"items":[],"scoring":"pending_license_review"}'::jsonb
  ),
  (
    'braden_placeholder',
    'Braden (preparado)',
    'Motor de evaluación listo. Cuestionario textual pendiente de verificación de licencia/uso.',
    'No incluir ítems textuales hasta confirmar derechos de uso.',
    '{"version":1,"items":[],"scoring":"pending_license_review"}'::jsonb
  ),
  (
    'morse_placeholder',
    'Morse (preparado)',
    'Motor de evaluación listo. Cuestionario textual pendiente de verificación de licencia/uso.',
    'No incluir ítems textuales hasta confirmar derechos de uso.',
    '{"version":1,"items":[],"scoring":"pending_license_review"}'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.geriatrics_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  definition_id UUID NOT NULL REFERENCES public.geriatrics_assessment_definitions(id),
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score NUMERIC(10,2),
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Evolutions (multidisciplinary; optional link to clinical_records)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  specialty TEXT NOT NULL DEFAULT 'medicina',
  content TEXT NOT NULL,
  clinical_record_id UUID REFERENCES public.clinical_records(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  correction_of_id UUID REFERENCES public.geriatrics_evolutions(id) ON DELETE SET NULL,
  is_correction BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_geri_evolutions_resident
  ON public.geriatrics_evolutions (clinic_id, resident_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Nutrition
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_nutrition_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  diet TEXT,
  texture TEXT,
  restrictions TEXT,
  allergies TEXT,
  supplements TEXT,
  hydration_target_ml INTEGER,
  weight_alert_percent NUMERIC(5,2) DEFAULT 5,
  observations TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT geriatrics_nutrition_resident UNIQUE (clinic_id, resident_id)
);

CREATE TABLE IF NOT EXISTS public.geriatrics_nutrition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  intake_percent INTEGER,
  hydration_ml INTEGER,
  weight_kg NUMERIC(6,2),
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Incidents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL
    CHECK (incident_type IN (
      'caida', 'lesion', 'herida', 'error_medicacion', 'traslado_urgencia',
      'episodio_conductual', 'otro'
    )),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL,
  staff_involved TEXT,
  actions_taken TEXT,
  family_notified BOOLEAN NOT NULL DEFAULT false,
  referral TEXT,
  follow_up TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_geri_incidents_clinic_time
  ON public.geriatrics_incidents (clinic_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Family / contacts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_legal_guardian BOOLEAN NOT NULL DEFAULT false,
  can_pickup BOOLEAN NOT NULL DEFAULT false,
  is_emergency BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Transfers / studies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geriatrics_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.geriatrics_residents(id) ON DELETE CASCADE,
  transfer_type TEXT NOT NULL
    CHECK (transfer_type IN (
      'consulta_externa', 'laboratorio', 'diagnostico_imagenes',
      'internacion', 'urgencia', 'programado'
    )),
  scheduled_at TIMESTAMPTZ,
  destination TEXT,
  reason TEXT,
  companion TEXT,
  transport TEXT,
  status TEXT NOT NULL DEFAULT 'programado'
    CHECK (status IN ('programado', 'en_traslado', 'realizado', 'cancelado')),
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geri_transfers_clinic_status
  ON public.geriatrics_transfers (clinic_id, status, scheduled_at);

-- ---------------------------------------------------------------------------
-- RLS helper + policies (clinic members; clinical write roles for clinical tables)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'geriatrics_rooms',
    'geriatrics_beds',
    'geriatrics_residents',
    'geriatrics_resident_status_history',
    'geriatrics_bed_assignments',
    'geriatrics_nursing_shifts',
    'geriatrics_nursing_notes',
    'geriatrics_medication_orders',
    'geriatrics_medication_administrations',
    'geriatrics_care_plans',
    'geriatrics_care_plan_items',
    'geriatrics_assessments',
    'geriatrics_evolutions',
    'geriatrics_nutrition_profiles',
    'geriatrics_nutrition_logs',
    'geriatrics_incidents',
    'geriatrics_contacts',
    'geriatrics_transfers'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      t || '_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
       USING (public.is_superadmin() OR clinic_id IN (SELECT public.user_clinic_ids()))',
      t || '_select', t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      t || '_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
       WITH CHECK (
         public.is_superadmin()
         OR (
           clinic_id IN (SELECT public.user_clinic_ids())
           AND public.user_role_in_clinic(clinic_id) IN (''clinic_admin'', ''doctor'', ''secretary'')
         )
       )',
      t || '_insert', t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      t || '_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
       USING (
         public.is_superadmin()
         OR (
           clinic_id IN (SELECT public.user_clinic_ids())
           AND public.user_role_in_clinic(clinic_id) IN (''clinic_admin'', ''doctor'', ''secretary'')
         )
       )
       WITH CHECK (
         public.is_superadmin()
         OR (
           clinic_id IN (SELECT public.user_clinic_ids())
           AND public.user_role_in_clinic(clinic_id) IN (''clinic_admin'', ''doctor'', ''secretary'')
         )
       )',
      t || '_update', t
    );
  END LOOP;
END;
$$;

-- Assessment definitions: read-only catalog for authenticated
ALTER TABLE public.geriatrics_assessment_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geriatrics_assessment_definitions_select ON public.geriatrics_assessment_definitions;
CREATE POLICY geriatrics_assessment_definitions_select
  ON public.geriatrics_assessment_definitions
  FOR SELECT TO authenticated
  USING (true);

-- Append-only: block silent UPDATE/DELETE on nursing notes & administrations & evolutions
CREATE OR REPLACE FUNCTION public.prevent_geriatrics_clinical_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Los registros clínicos geriátricos son append-only; use correcciones auditadas';
END;
$$;

DROP TRIGGER IF EXISTS geriatrics_nursing_notes_immutable ON public.geriatrics_nursing_notes;
CREATE TRIGGER geriatrics_nursing_notes_immutable
  BEFORE UPDATE OR DELETE ON public.geriatrics_nursing_notes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_geriatrics_clinical_mutation();

DROP TRIGGER IF EXISTS geriatrics_med_admin_immutable ON public.geriatrics_medication_administrations;
CREATE TRIGGER geriatrics_med_admin_immutable
  BEFORE UPDATE OR DELETE ON public.geriatrics_medication_administrations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_geriatrics_clinical_mutation();

DROP TRIGGER IF EXISTS geriatrics_evolutions_immutable ON public.geriatrics_evolutions;
CREATE TRIGGER geriatrics_evolutions_immutable
  BEFORE UPDATE OR DELETE ON public.geriatrics_evolutions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_geriatrics_clinical_mutation();

NOTIFY pgrst, 'reload schema';
