-- Reparación: columnas de receta electrónica (Argentina)
-- Ejecutá esto si al guardar recetas ves:
--   "Could not find the 'diagnosis_cie10' column of 'prescription_drafts' in the schema cache"
-- Es idempotente: seguro correrlo más de una vez.

ALTER TABLE prescription_drafts
  ADD COLUMN IF NOT EXISTS prescription_type TEXT NOT NULL DEFAULT 'ambulatoria',
  ADD COLUMN IF NOT EXISTS diagnosis_cie10 TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_text TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS prescription_number TEXT,
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validity_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS refeps_status TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS refeps_id TEXT,
  ADD COLUMN IF NOT EXISTS patient_insurance TEXT;

DO $$ BEGIN
  ALTER TABLE prescription_drafts
    ADD CONSTRAINT prescription_drafts_type_check
    CHECK (prescription_type IN ('ambulatoria', 'cronica', 'duplicado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE prescription_drafts
    ADD CONSTRAINT prescription_drafts_status_check
    CHECK (status IN ('draft', 'issued', 'void'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE prescription_drafts
    ADD CONSTRAINT prescription_drafts_refeps_status_check
    CHECK (refeps_status IN ('local', 'pending_refeps', 'submitted'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION set_prescription_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.prescription_number IS NULL OR NEW.prescription_number = '' THEN
    NEW.prescription_number := 'RX-AR-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescription_number ON prescription_drafts;
CREATE TRIGGER trg_prescription_number
  BEFORE INSERT ON prescription_drafts
  FOR EACH ROW EXECUTE FUNCTION set_prescription_number();

CREATE INDEX IF NOT EXISTS idx_prescription_drafts_clinic_status
  ON prescription_drafts(clinic_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescription_drafts_patient
  ON prescription_drafts(patient_id, created_at DESC);
