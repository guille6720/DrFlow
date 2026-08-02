-- Campos ampliados para ficha de ingreso de profesionales

ALTER TABLE professionals ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS office_phone TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS office_address TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS accepted_insurances TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS intake_notes TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS intake_completed_at TIMESTAMPTZ;
