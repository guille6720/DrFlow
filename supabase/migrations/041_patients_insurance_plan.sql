-- Plan de cobertura del paciente (ej. PAMI 310, PMO).
-- REDUNDANTE con 034_secretaria_caja.sql — mantener solo por historial de deploy.
-- Idempotente: ADD COLUMN IF NOT EXISTS.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS insurance_plan TEXT;

COMMENT ON COLUMN patients.insurance_plan IS 'Plan o modalidad de la cobertura (ej. 310, PMO, Plan Joven)';
