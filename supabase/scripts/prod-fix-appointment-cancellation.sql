-- Prod fix: structured cancellation + reschedule metadata (migration 085)
-- Run in Supabase SQL Editor if cancel appointment fails on cancellation_category.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancellation_category TEXT
    CHECK (cancellation_category IS NULL OR cancellation_category IN (
      'patient', 'professional', 'clinic', 'data_error', 'other'
    )),
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN appointments.cancellation_category IS 'Motivo estructurado de cancelación.';
COMMENT ON COLUMN appointments.rescheduled_at IS 'Última reprogramación del turno (misma fila, nueva fecha/hora).';

CREATE INDEX IF NOT EXISTS idx_appointments_rescheduled
  ON appointments (clinic_id, rescheduled_at DESC)
  WHERE rescheduled_at IS NOT NULL;
