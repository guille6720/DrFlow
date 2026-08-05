-- Secretaría + Caja / Cobranzas (DrFlow)
-- Migración 034: módulo administrativo independiente de la HC

-- ---------------------------------------------------------------------------
-- Enums (idempotent)
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE waiting_room_status AS ENUM (
  'waiting', 'confirmed', 'in_consultation', 'finished', 'cancelled', 'absent'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE cash_attention_type AS ENUM (
  'particular', 'obra_social', 'prepaga', 'art', 'sin_cargo'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE cash_charge_kind AS ENUM (
  'consulta_particular', 'copago_autorizado', 'coseguro_autorizado', 'practica',
  'certificado_medico', 'apto_fisico', 'vacunacion', 'control', 'procedimiento', 'otro'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE cash_charge_status AS ENUM (
  'pending', 'collected', 'voided', 'refunded'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE cash_payment_method AS ENUM (
  'cash', 'debit', 'credit', 'transfer', 'mercadopago', 'qr', 'account'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE admin_document_category AS ENUM (
  'authorization', 'medical_order', 'patient_study', 'general', 'other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE cash_invoice_status AS ENUM (
  'draft', 'issued', 'cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Clínica: configuración caja
-- ---------------------------------------------------------------------------
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS doctors_can_access_cash BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS insurance_plan TEXT;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS waiting_room_status waiting_room_status NOT NULL DEFAULT 'waiting';

CREATE INDEX IF NOT EXISTS idx_appointments_waiting_room
  ON appointments (clinic_id, start_at, waiting_room_status);

-- ---------------------------------------------------------------------------
-- Catálogos normalizados (tipos de cobro y medios de pago)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_charge_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  code cash_charge_kind NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, code)
);

CREATE TABLE IF NOT EXISTS cash_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  code cash_payment_method NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, code)
);

-- ---------------------------------------------------------------------------
-- Cobros (Caja)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  charge_type_id UUID REFERENCES cash_charge_types(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES cash_payment_methods(id) ON DELETE SET NULL,
  charge_kind cash_charge_kind NOT NULL,
  attention_type cash_attention_type NOT NULL DEFAULT 'particular',
  payment_method cash_payment_method NOT NULL DEFAULT 'cash',
  motive TEXT,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  status cash_charge_status NOT NULL DEFAULT 'pending',
  charged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_charges_clinic_date ON cash_charges (clinic_id, charged_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_charges_patient ON cash_charges (patient_id, charged_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_charges_professional ON cash_charges (professional_id, charged_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_charges_status ON cash_charges (clinic_id, status);

-- ---------------------------------------------------------------------------
-- Cuenta corriente del paciente
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  cash_charge_id UUID REFERENCES cash_charges(id) ON DELETE SET NULL,
  entry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  concept TEXT NOT NULL,
  debit DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  balance_after DECIMAL(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX IF NOT EXISTS idx_patient_ledger_patient ON patient_ledger_entries (patient_id, entry_at DESC);

-- ---------------------------------------------------------------------------
-- Facturación (preparado AFIP / ARCA)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  cash_charge_id UUID REFERENCES cash_charges(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  invoice_number TEXT,
  status cash_invoice_status NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  cae TEXT,
  cae_expires_at TIMESTAMPTZ,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Cierre diario de caja
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_daily_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  closure_date DATE NOT NULL,
  totals JSONB NOT NULL DEFAULT '{}',
  patient_count INT NOT NULL DEFAULT 0,
  consultation_count INT NOT NULL DEFAULT 0,
  cash_difference DECIMAL(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  closed_by UUID REFERENCES profiles(id),
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, closure_date)
);

-- ---------------------------------------------------------------------------
-- Documentación administrativa (separada de HC)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_admin_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  category admin_document_category NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INT,
  uploaded_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_admin_docs ON patient_admin_documents (patient_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed catálogos globales (clinic_id NULL = plantilla del sistema)
-- ---------------------------------------------------------------------------
INSERT INTO cash_charge_types (clinic_id, code, label, sort_order)
SELECT v.clinic_id, v.code, v.label, v.sort_order
FROM (VALUES
  (NULL::uuid, 'consulta_particular'::cash_charge_kind, 'Consulta Particular', 1),
  (NULL, 'copago_autorizado', 'Copago autorizado', 2),
  (NULL, 'coseguro_autorizado', 'Coseguro autorizado', 3),
  (NULL, 'practica', 'Práctica', 4),
  (NULL, 'certificado_medico', 'Certificado Médico', 5),
  (NULL, 'apto_fisico', 'Apto Físico', 6),
  (NULL, 'vacunacion', 'Vacunación', 7),
  (NULL, 'control', 'Control', 8),
  (NULL, 'procedimiento', 'Procedimiento', 9),
  (NULL, 'otro', 'Otro', 10)
) AS v(clinic_id, code, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM cash_charge_types c
  WHERE c.clinic_id IS NOT DISTINCT FROM v.clinic_id AND c.code = v.code
);

INSERT INTO cash_payment_methods (clinic_id, code, label, sort_order)
SELECT v.clinic_id, v.code, v.label, v.sort_order
FROM (VALUES
  (NULL::uuid, 'cash'::cash_payment_method, 'Efectivo', 1),
  (NULL, 'debit', 'Débito', 2),
  (NULL, 'credit', 'Crédito', 3),
  (NULL, 'transfer', 'Transferencia', 4),
  (NULL, 'mercadopago', 'Mercado Pago', 5),
  (NULL, 'qr', 'QR', 6),
  (NULL, 'account', 'Cuenta Corriente', 7)
) AS v(clinic_id, code, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM cash_payment_methods c
  WHERE c.clinic_id IS NOT DISTINCT FROM v.clinic_id AND c.code = v.code
);

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_view_clinical(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_superadmin() OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'doctor');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_manage_cash(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    is_superadmin()
    OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'secretary')
    OR (
      user_role_in_clinic(p_clinic_id) = 'doctor'
      AND EXISTS (
        SELECT 1 FROM clinics c
        WHERE c.id = p_clinic_id AND COALESCE(c.doctors_can_access_cash, true)
      )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_manage_admin_docs(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_superadmin() OR user_role_in_clinic(p_clinic_id) IN ('clinic_admin', 'secretary');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
ALTER TABLE cash_charge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_daily_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_admin_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_charge_types_select ON cash_charge_types;
CREATE POLICY cash_charge_types_select ON cash_charge_types FOR SELECT
  USING (clinic_id IS NULL OR clinic_id IN (SELECT user_clinic_ids()));

DROP POLICY IF EXISTS cash_payment_methods_select ON cash_payment_methods;
CREATE POLICY cash_payment_methods_select ON cash_payment_methods FOR SELECT
  USING (clinic_id IS NULL OR clinic_id IN (SELECT user_clinic_ids()));

DROP POLICY IF EXISTS cash_charges_all ON cash_charges;
CREATE POLICY cash_charges_all ON cash_charges FOR ALL
  USING (can_manage_cash(clinic_id))
  WITH CHECK (can_manage_cash(clinic_id));

DROP POLICY IF EXISTS patient_ledger_all ON patient_ledger_entries;
CREATE POLICY patient_ledger_all ON patient_ledger_entries FOR ALL
  USING (can_manage_cash(clinic_id))
  WITH CHECK (can_manage_cash(clinic_id));

DROP POLICY IF EXISTS cash_invoices_all ON cash_invoices;
CREATE POLICY cash_invoices_all ON cash_invoices FOR ALL
  USING (can_manage_cash(clinic_id))
  WITH CHECK (can_manage_cash(clinic_id));

DROP POLICY IF EXISTS cash_daily_closures_all ON cash_daily_closures;
CREATE POLICY cash_daily_closures_all ON cash_daily_closures FOR ALL
  USING (can_manage_cash(clinic_id))
  WITH CHECK (can_manage_cash(clinic_id));

DROP POLICY IF EXISTS patient_admin_documents_all ON patient_admin_documents;
CREATE POLICY patient_admin_documents_all ON patient_admin_documents FOR ALL
  USING (can_manage_admin_docs(clinic_id))
  WITH CHECK (can_manage_admin_docs(clinic_id));

-- Realtime: appointments waiting room (optional, habilitar en Supabase dashboard)
-- ALTER PUBLICATION supabase_realtime ADD TABLE appointments;

COMMENT ON TABLE cash_charges IS 'Cobros de caja — módulo administrativo separado de payments (mock MP)';
COMMENT ON TABLE patient_ledger_entries IS 'Cuenta corriente del paciente con saldo acumulado';
COMMENT ON TABLE patient_admin_documents IS 'Documentación administrativa; no es historia clínica';
