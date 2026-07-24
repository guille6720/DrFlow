-- Prueba comercial por clínica (ej. 30 días desde /probar).
-- NULL = sin límite de trial (clínicas existentes y altas normales).

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN clinics.trial_ends_at IS
  'Fin de periodo de prueba comercial; NULL = sin trial activo';
