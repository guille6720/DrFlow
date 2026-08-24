-- Phase 21 — Subscription cancellation: paid-through access until period end.
-- Canceled subscriptions with a future current_period_end still grant access.
-- Staging/local only. Not legal advice.

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
      AND (
        (
          s.status IN ('active', 'manual')
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
        )
        OR (
          s.status = 'canceled'
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end > now()
        )
      )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION clinic_subscription_active(UUID) IS
  'Trial vigente OR suscripción active/manual con período vigente OR canceled con current_period_end futuro (pago ya cobrado).';
