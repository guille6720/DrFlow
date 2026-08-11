-- Production fix: Fase 4B liquidación obras sociales (migration 103). Safe to re-run.
-- Apply full migration 103 if tables are missing; this script mirrors idempotent DDL.

DO $$ BEGIN
  CREATE TYPE os_billable_status AS ENUM (
    'pending', 'in_batch', 'submitted', 'paid', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE os_liquidation_status AS ENUM (
    'draft', 'submitted', 'paid', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS os_fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  insurance_provider TEXT NOT NULL,
  practice_code TEXT NOT NULL DEFAULT '420101',
  practice_label TEXT NOT NULL DEFAULT 'Consulta médica',
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, insurance_provider, practice_code)
);

CREATE TABLE IF NOT EXISTS os_liquidation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  insurance_provider TEXT NOT NULL,
  period_from TIMESTAMPTZ NOT NULL,
  period_to TIMESTAMPTZ NOT NULL,
  status os_liquidation_status NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  item_count INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_to > period_from)
);

CREATE TABLE IF NOT EXISTS os_billable_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  liquidation_batch_id UUID REFERENCES os_liquidation_batches(id) ON DELETE SET NULL,
  insurance_provider TEXT NOT NULL,
  insurance_number TEXT,
  insurance_plan TEXT,
  practice_code TEXT NOT NULL DEFAULT '420101',
  practice_label TEXT NOT NULL DEFAULT 'Consulta médica',
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  copago_collected DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (copago_collected >= 0),
  status os_billable_status NOT NULL DEFAULT 'pending',
  attended_at TIMESTAMPTZ NOT NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_os_billable_items_appointment
  ON os_billable_items (clinic_id, appointment_id)
  WHERE appointment_id IS NOT NULL;

-- Re-run functions from migration 103 (copy via \i in psql or paste functions block in prod)
-- For brevity: run supabase/migrations/103_os_liquidacion.sql helpers section in prod SQL editor.
