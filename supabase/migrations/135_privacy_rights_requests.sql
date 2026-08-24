-- Phase 12: administrative workflow for privacy / habeas data (Ley 25.326) requests.
-- Does NOT authorize automated destruction of retained clinical records (Ley 26.529).

CREATE TABLE IF NOT EXISTS privacy_rights_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL
    CHECK (request_type IN (
      'access',
      'correction',
      'export',
      'deletion',
      'blocking',
      'opposition'
    )),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN (
      'received',
      'in_review',
      'awaiting_identity',
      'fulfilled',
      'rejected',
      'cancelled'
    )),
  requester_name TEXT,
  requester_contact TEXT,
  description TEXT,
  /** Staff must ack retention warning before fulfilling deletion/blocking. */
  retention_warning_acknowledged BOOLEAN NOT NULL DEFAULT false,
  resolution_notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE privacy_rights_requests IS
  'Cola administrativa de pedidos ARCO / habeas data. No dispara hard-delete de HC.';
COMMENT ON COLUMN privacy_rights_requests.request_type IS
  'access | correction | export | deletion | blocking | opposition';
COMMENT ON COLUMN privacy_rights_requests.retention_warning_acknowledged IS
  'Obligatorio true para cerrar deletion/blocking: HC se conserva según retención clínica.';

CREATE INDEX IF NOT EXISTS idx_privacy_rights_requests_clinic_status
  ON privacy_rights_requests (clinic_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_privacy_rights_requests_patient
  ON privacy_rights_requests (clinic_id, patient_id, created_at DESC)
  WHERE patient_id IS NOT NULL;

ALTER TABLE privacy_rights_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS privacy_rights_requests_select ON privacy_rights_requests;
CREATE POLICY privacy_rights_requests_select ON privacy_rights_requests FOR SELECT
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) IN ('clinic_admin', 'doctor', 'secretary')
  );

DROP POLICY IF EXISTS privacy_rights_requests_insert ON privacy_rights_requests;
CREATE POLICY privacy_rights_requests_insert ON privacy_rights_requests FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) IN ('clinic_admin', 'doctor', 'secretary')
  );

DROP POLICY IF EXISTS privacy_rights_requests_update ON privacy_rights_requests;
CREATE POLICY privacy_rights_requests_update ON privacy_rights_requests FOR UPDATE
  USING (
    is_superadmin()
    OR user_role_in_clinic(clinic_id) IN ('clinic_admin', 'doctor')
  );

-- No DELETE policy — keep request history (cancel via status).

CREATE OR REPLACE FUNCTION public.touch_privacy_rights_request_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS privacy_rights_requests_touch_updated ON privacy_rights_requests;
CREATE TRIGGER privacy_rights_requests_touch_updated
  BEFORE UPDATE ON privacy_rights_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_privacy_rights_request_updated_at();

-- Guard: cannot fulfill deletion/blocking without retention acknowledgment
CREATE OR REPLACE FUNCTION public.enforce_privacy_deletion_retention_ack()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'fulfilled'
     AND NEW.request_type IN ('deletion', 'blocking')
     AND NEW.retention_warning_acknowledged IS NOT TRUE
  THEN
    RAISE EXCEPTION 'PRIVACY_RETENTION_ACK_REQUIRED'
      USING HINT = 'Deletion/blocking fulfillment requires retention_warning_acknowledged = true. Clinical records must not be auto-destroyed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS privacy_rights_requests_retention_ack ON privacy_rights_requests;
CREATE TRIGGER privacy_rights_requests_retention_ack
  BEFORE INSERT OR UPDATE ON privacy_rights_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_privacy_deletion_retention_ack();
