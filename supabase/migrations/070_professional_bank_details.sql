-- Datos bancarios y fiscales del profesional (ingreso / ficha médica)

ALTER TABLE professionals ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS iva_status TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS bank_account_type TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS bank_cbu TEXT;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS bank_alias TEXT;

COMMENT ON COLUMN professionals.tax_id IS 'CUIL/CUIT del profesional';
COMMENT ON COLUMN professionals.iva_status IS 'Condición frente al IVA';
COMMENT ON COLUMN professionals.bank_name IS 'Nombre del banco';
COMMENT ON COLUMN professionals.bank_account_type IS 'Tipo de cuenta bancaria';
COMMENT ON COLUMN professionals.bank_account_number IS 'Número de cuenta';
COMMENT ON COLUMN professionals.bank_cbu IS 'CBU (22 dígitos)';
COMMENT ON COLUMN professionals.bank_alias IS 'Alias de transferencia';
