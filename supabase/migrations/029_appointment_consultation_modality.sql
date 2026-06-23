-- Modalidad de consulta: presencial o virtual (telemedicina).

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS consultation_modality TEXT NOT NULL DEFAULT 'presencial'
  CHECK (consultation_modality IN ('presencial', 'virtual'));

UPDATE appointments a
SET consultation_modality = 'virtual'
WHERE consultation_modality = 'presencial'
  AND EXISTS (
    SELECT 1 FROM telemedicine_sessions ts
    WHERE ts.appointment_id = a.id
  );

CREATE INDEX IF NOT EXISTS idx_appointments_attended_modality
  ON appointments (clinic_id, status, start_at, consultation_modality)
  WHERE status = 'attended';
