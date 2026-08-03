-- Phase 16: observability — structured logs, metrics, errors, slow queries.

CREATE TABLE IF NOT EXISTS clinic_observability_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  category TEXT NOT NULL
    CHECK (category IN ('error', 'performance', 'job', 'api', 'query')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok'
    CHECK (status IN ('ok', 'warn', 'error')),
  path TEXT,
  duration_ms INT,
  trace_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observability_clinic_created
  ON clinic_observability_events(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_observability_status_created
  ON clinic_observability_events(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_observability_category_created
  ON clinic_observability_events(category, created_at DESC);

ALTER TABLE clinic_observability_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS observability_events_select ON clinic_observability_events;
CREATE POLICY observability_events_select ON clinic_observability_events FOR SELECT
  USING (
    is_superadmin()
    OR (clinic_id IS NOT NULL AND clinic_id IN (SELECT user_clinic_ids()))
  );

DROP POLICY IF EXISTS observability_events_insert ON clinic_observability_events;
CREATE POLICY observability_events_insert ON clinic_observability_events FOR INSERT
  WITH CHECK (
    is_superadmin()
    OR (clinic_id IS NOT NULL AND clinic_id IN (SELECT user_clinic_ids()))
    OR clinic_id IS NULL
  );

COMMENT ON TABLE clinic_observability_events IS 'Telemetría estructurada por clínica — Phase 16.';

-- Purge events older than 30 days (callable from cron).
CREATE OR REPLACE FUNCTION purge_old_observability_events(p_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM clinic_observability_events
  WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION purge_old_observability_events(INT) FROM PUBLIC;
