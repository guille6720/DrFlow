-- Fase 4B: Facturación y liquidación obras sociales
-- Tarifas por OS, ítems facturables desde atenciones, lotes de liquidación.

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

-- Tarifas configurables por obra social / prepaga
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

CREATE INDEX IF NOT EXISTS idx_os_fee_schedules_clinic
  ON os_fee_schedules (clinic_id, insurance_provider);

-- Ítems facturables (desde atenciones o manual)
CREATE TABLE IF NOT EXISTS os_billable_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  liquidation_batch_id UUID,
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

CREATE INDEX IF NOT EXISTS idx_os_billable_items_clinic_status
  ON os_billable_items (clinic_id, status, attended_at DESC);

CREATE INDEX IF NOT EXISTS idx_os_billable_items_batch
  ON os_billable_items (liquidation_batch_id);

-- Lotes de liquidación presentados a la OS
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

CREATE INDEX IF NOT EXISTS idx_os_liquidation_batches_clinic
  ON os_liquidation_batches (clinic_id, created_at DESC);

ALTER TABLE os_billable_items
  DROP CONSTRAINT IF EXISTS os_billable_items_liquidation_batch_id_fkey;

ALTER TABLE os_billable_items
  ADD CONSTRAINT os_billable_items_liquidation_batch_id_fkey
  FOREIGN KEY (liquidation_batch_id) REFERENCES os_liquidation_batches(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Dependency: can_manage_cash (migration 034 caja; prod may not have it yet)
-- ---------------------------------------------------------------------------
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS doctors_can_access_cash BOOLEAN NOT NULL DEFAULT true;

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

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resolve_os_fee_amount(
  p_clinic_id UUID,
  p_insurance_provider TEXT,
  p_practice_code TEXT DEFAULT '420101'
)
RETURNS DECIMAL(12, 2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT amount
      FROM os_fee_schedules
      WHERE clinic_id = p_clinic_id
        AND is_active = true
        AND practice_code = p_practice_code
        AND lower(trim(insurance_provider)) = lower(trim(p_insurance_provider))
      LIMIT 1
    ),
    0
  );
$$;

GRANT EXECUTE ON FUNCTION resolve_os_fee_amount(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION summarize_os_liquidation_pending(p_clinic_id UUID)
RETURNS TABLE (
  insurance_provider TEXT,
  pending_count BIGINT,
  pending_amount NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bi.insurance_provider,
    COUNT(*)::BIGINT AS pending_count,
    COALESCE(SUM(bi.amount), 0)::NUMERIC AS pending_amount
  FROM os_billable_items bi
  WHERE bi.clinic_id = p_clinic_id
    AND bi.status = 'pending'
  GROUP BY bi.insurance_provider
  ORDER BY bi.insurance_provider;
$$;

GRANT EXECUTE ON FUNCTION summarize_os_liquidation_pending(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION create_os_liquidation_batch(
  p_clinic_id UUID,
  p_insurance_provider TEXT,
  p_period_from TIMESTAMPTZ,
  p_period_to TIMESTAMPTZ,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id UUID;
  v_item_count INT := 0;
  v_total NUMERIC := 0;
  v_appt RECORD;
  v_provider TEXT;
  v_fee NUMERIC;
  v_copago NUMERIC;
  v_item_id UUID;
BEGIN
  IF NOT can_manage_cash(p_clinic_id) THEN
    RAISE EXCEPTION 'Sin permiso para liquidación';
  END IF;

  IF p_period_to <= p_period_from THEN
    RAISE EXCEPTION 'El período es inválido';
  END IF;

  INSERT INTO os_liquidation_batches (
    clinic_id,
    insurance_provider,
    period_from,
    period_to,
    status,
    created_by
  ) VALUES (
    p_clinic_id,
    trim(p_insurance_provider),
    p_period_from,
    p_period_to,
    'draft',
    p_created_by
  )
  RETURNING id INTO v_batch_id;

  FOR v_appt IN
    SELECT
      a.id AS appointment_id,
      a.start_at,
      a.patient_id,
      a.professional_id,
      COALESCE(a.insurance_provider_snapshot, p.insurance_provider, 'Sin cobertura') AS insurance_provider,
      p.insurance_number,
      p.insurance_plan
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.clinic_id = p_clinic_id
      AND a.status = 'attended'
      AND a.start_at >= p_period_from
      AND a.start_at < p_period_to
      AND lower(trim(COALESCE(a.insurance_provider_snapshot, p.insurance_provider, '')))
          = lower(trim(p_insurance_provider))
      AND NOT EXISTS (
        SELECT 1 FROM os_billable_items bi
        WHERE bi.clinic_id = p_clinic_id
          AND bi.appointment_id = a.id
          AND bi.status <> 'rejected'
      )
  LOOP
    v_fee := resolve_os_fee_amount(p_clinic_id, v_appt.insurance_provider, '420101');
    IF v_fee <= 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(cc.amount), 0) INTO v_copago
    FROM cash_charges cc
    WHERE cc.clinic_id = p_clinic_id
      AND cc.appointment_id = v_appt.appointment_id
      AND cc.status = 'collected'
      AND cc.attention_type = 'obra_social';

    INSERT INTO os_billable_items (
      clinic_id,
      appointment_id,
      patient_id,
      professional_id,
      liquidation_batch_id,
      insurance_provider,
      insurance_number,
      insurance_plan,
      practice_code,
      practice_label,
      amount,
      copago_collected,
      status,
      attended_at
    ) VALUES (
      p_clinic_id,
      v_appt.appointment_id,
      v_appt.patient_id,
      v_appt.professional_id,
      v_batch_id,
      v_appt.insurance_provider,
      v_appt.insurance_number,
      v_appt.insurance_plan,
      '420101',
      'Consulta médica',
      v_fee,
      v_copago,
      'in_batch',
      v_appt.start_at
    )
    RETURNING id INTO v_item_id;

    v_item_count := v_item_count + 1;
    v_total := v_total + v_fee;
  END LOOP;

  -- Reutilizar ítems pending existentes del mismo proveedor en el período
  UPDATE os_billable_items bi
  SET
    liquidation_batch_id = v_batch_id,
    status = 'in_batch',
    updated_at = now()
  WHERE bi.clinic_id = p_clinic_id
    AND bi.status = 'pending'
    AND lower(trim(bi.insurance_provider)) = lower(trim(p_insurance_provider))
    AND bi.attended_at >= p_period_from
    AND bi.attended_at < p_period_to
    AND bi.liquidation_batch_id IS NULL;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_item_count, v_total
  FROM os_billable_items
  WHERE liquidation_batch_id = v_batch_id;

  UPDATE os_liquidation_batches
  SET
    item_count = v_item_count,
    total_amount = v_total,
    updated_at = now()
  WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'item_count', v_item_count,
    'total_amount', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_os_liquidation_batch(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION update_os_liquidation_batch_status(
  p_clinic_id UUID,
  p_batch_id UUID,
  p_status os_liquidation_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_status os_billable_status;
BEGIN
  IF NOT can_manage_cash(p_clinic_id) THEN
    RAISE EXCEPTION 'Sin permiso para liquidación';
  END IF;

  IF p_status = 'submitted' THEN
    v_item_status := 'submitted';
    UPDATE os_liquidation_batches
    SET status = 'submitted', submitted_at = now(), updated_at = now()
    WHERE id = p_batch_id AND clinic_id = p_clinic_id;
  ELSIF p_status = 'paid' THEN
    v_item_status := 'paid';
    UPDATE os_liquidation_batches
    SET status = 'paid', paid_at = now(), updated_at = now()
    WHERE id = p_batch_id AND clinic_id = p_clinic_id;
  ELSIF p_status = 'cancelled' THEN
    UPDATE os_liquidation_batches
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_batch_id AND clinic_id = p_clinic_id;

    UPDATE os_billable_items
    SET
      liquidation_batch_id = NULL,
      status = 'pending',
      updated_at = now()
    WHERE liquidation_batch_id = p_batch_id AND clinic_id = p_clinic_id;

    RETURN jsonb_build_object('batch_id', p_batch_id, 'status', 'cancelled');
  ELSE
    RAISE EXCEPTION 'Estado no soportado';
  END IF;

  UPDATE os_billable_items
  SET status = v_item_status, updated_at = now()
  WHERE liquidation_batch_id = p_batch_id AND clinic_id = p_clinic_id;

  RETURN jsonb_build_object('batch_id', p_batch_id, 'status', p_status::TEXT);
END;
$$;

GRANT EXECUTE ON FUNCTION update_os_liquidation_batch_status(UUID, UUID, os_liquidation_status) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE os_fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_billable_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_liquidation_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS os_fee_schedules_all ON os_fee_schedules;
CREATE POLICY os_fee_schedules_all ON os_fee_schedules FOR ALL
  USING (can_manage_cash(clinic_id))
  WITH CHECK (can_manage_cash(clinic_id));

DROP POLICY IF EXISTS os_billable_items_all ON os_billable_items;
CREATE POLICY os_billable_items_all ON os_billable_items FOR ALL
  USING (can_manage_cash(clinic_id))
  WITH CHECK (can_manage_cash(clinic_id));

DROP POLICY IF EXISTS os_liquidation_batches_all ON os_liquidation_batches;
CREATE POLICY os_liquidation_batches_all ON os_liquidation_batches FOR ALL
  USING (can_manage_cash(clinic_id))
  WITH CHECK (can_manage_cash(clinic_id));

COMMENT ON TABLE os_fee_schedules IS 'Tarifas de práctica por obra social / prepaga (Fase 4B).';
COMMENT ON TABLE os_billable_items IS 'Ítems facturables a liquidar ante OS (desde atenciones).';
COMMENT ON TABLE os_liquidation_batches IS 'Lotes de liquidación presentados o pagados por OS.';
