-- Fase 2A: suscripciones SaaS DrFlow vía Mercado Pago Checkout Pro

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clinic_subscription_status') THEN
    CREATE TYPE clinic_subscription_status AS ENUM (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'manual'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS clinic_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('solo', 'consultorio', 'clinica')),
  status clinic_subscription_status NOT NULL DEFAULT 'trialing',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  mercado_pago_preapproval_id TEXT,
  mercado_pago_payer_email TEXT,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id)
);

CREATE TABLE IF NOT EXISTS clinic_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES clinic_subscriptions(id) ON DELETE SET NULL,
  mercado_pago_payment_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  status TEXT NOT NULL,
  plan_id TEXT,
  billing_cycle TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_status
  ON clinic_subscriptions (status, current_period_end);

CREATE INDEX IF NOT EXISTS idx_clinic_subscription_payments_clinic
  ON clinic_subscription_payments (clinic_id, created_at DESC);

COMMENT ON TABLE clinic_subscriptions IS 'Suscripción SaaS del consultorio (Mercado Pago Checkout Pro).';
COMMENT ON TABLE clinic_subscription_payments IS 'Pagos de suscripción registrados vía webhook MP (idempotente por payment_id).';

ALTER TABLE clinic_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_subscriptions_select ON clinic_subscriptions;
CREATE POLICY clinic_subscriptions_select ON clinic_subscriptions
  FOR SELECT
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) IS NOT NULL
  );

DROP POLICY IF EXISTS clinic_subscription_payments_select ON clinic_subscription_payments;
CREATE POLICY clinic_subscription_payments_select ON clinic_subscription_payments
  FOR SELECT
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) IN ('clinic_admin', 'doctor', 'secretary')
  );

-- Activo si: trial vigente OR suscripción activa con período vigente OR acceso manual permanente
CREATE OR REPLACE FUNCTION clinic_subscription_active(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM clinics c
    WHERE c.id = p_clinic_id
      AND (
        c.trial_ends_at IS NULL
        OR c.trial_ends_at > now()
      )
  )
  OR EXISTS (
    SELECT 1 FROM clinic_subscriptions s
    WHERE s.clinic_id = p_clinic_id
      AND s.status IN ('active', 'manual')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
