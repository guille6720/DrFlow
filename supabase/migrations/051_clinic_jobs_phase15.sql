-- Phase 15: async job queue per clinic (WhatsApp, email, PDF, imports, IA, reports).

CREATE TABLE IF NOT EXISTS clinic_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_jobs_clinic_status
  ON clinic_jobs(clinic_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_clinic_jobs_worker
  ON clinic_jobs(status, scheduled_at)
  WHERE status IN ('pending', 'running');

ALTER TABLE clinic_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_jobs_select ON clinic_jobs;
CREATE POLICY clinic_jobs_select ON clinic_jobs FOR SELECT
  USING (
    is_superadmin()
    OR clinic_id IN (SELECT user_clinic_ids())
  );

DROP POLICY IF EXISTS clinic_jobs_insert ON clinic_jobs;
CREATE POLICY clinic_jobs_insert ON clinic_jobs FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR clinic_id IN (SELECT user_clinic_ids())
  );

COMMENT ON TABLE clinic_jobs IS 'Cola de trabajos asíncronos por clínica — Phase 15.';

-- Worker claim (SECURITY DEFINER — service role / cron only).
CREATE OR REPLACE FUNCTION claim_clinic_jobs(p_limit INT DEFAULT 10)
RETURNS SETOF clinic_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE clinic_jobs j
  SET
    status = 'running',
    started_at = now(),
    attempts = j.attempts + 1,
    updated_at = now()
  WHERE j.id IN (
    SELECT id FROM clinic_jobs
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND attempts < max_attempts
    ORDER BY scheduled_at ASC
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION complete_clinic_job(
  p_job_id UUID,
  p_status TEXT,
  p_result JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('completed', 'failed', 'cancelled', 'pending') THEN
    RAISE EXCEPTION 'Invalid job status: %', p_status;
  END IF;

  UPDATE clinic_jobs
  SET
    status = p_status,
    result = COALESCE(p_result, result),
    error_message = p_error_message,
    completed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN now() ELSE completed_at END,
    updated_at = now(),
    scheduled_at = CASE
      WHEN p_status = 'pending' THEN now() + interval '30 seconds'
      ELSE scheduled_at
    END
  WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION claim_clinic_jobs(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_clinic_job(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
