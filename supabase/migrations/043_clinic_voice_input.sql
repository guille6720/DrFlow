-- Dictado por voz en historias clínicas (activable por consultorio)

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS voice_input_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN clinics.voice_input_enabled IS
  'Si false, el consultorio desactiva el botón de dictado por voz en HC.';
