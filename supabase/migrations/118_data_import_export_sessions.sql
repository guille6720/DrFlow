-- Phase 1 import/export: wizard sessions + reusable column-mapping templates.
-- Does not alter existing patients / clinical_records / audit_logs schema.
-- Staging files remain in clinical-files under {clinic_id}/import-staging/.

CREATE TABLE IF NOT EXISTS public.data_import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  import_type TEXT NOT NULL DEFAULT 'patients'
    CHECK (import_type IN ('patients', 'clinical_records', 'fhir', 'documents')),
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'parsing'
    CHECK (
      status IN (
        'uploading',
        'parsing',
        'validating',
        'ready',
        'importing',
        'completed',
        'completed_with_warnings',
        'failed',
        'cancelled'
      )
    ),
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  date_format TEXT,
  template_id UUID,
  headers JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  duplicate_decisions JSONB NOT NULL DEFAULT '{}'::jsonb,
  invalid_sample JSONB NOT NULL DEFAULT '[]'::jsonb,
  duplicate_sample JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_summary TEXT,
  imported_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_import_sessions_clinic_created
  ON public.data_import_sessions (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_import_sessions_clinic_status
  ON public.data_import_sessions (clinic_id, status);

CREATE TABLE IF NOT EXISTS public.import_mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  import_type TEXT NOT NULL DEFAULT 'patients'
    CHECK (import_type IN ('patients', 'clinical_records', 'fhir', 'documents')),
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  date_format TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, import_type, name)
);

CREATE INDEX IF NOT EXISTS idx_import_mapping_templates_clinic_type
  ON public.import_mapping_templates (clinic_id, import_type);

ALTER TABLE public.data_import_sessions
  DROP CONSTRAINT IF EXISTS data_import_sessions_template_fk;

ALTER TABLE public.data_import_sessions
  ADD CONSTRAINT data_import_sessions_template_fk
  FOREIGN KEY (template_id) REFERENCES public.import_mapping_templates(id) ON DELETE SET NULL;

ALTER TABLE public.data_import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_mapping_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_import_sessions_select ON public.data_import_sessions;
CREATE POLICY data_import_sessions_select ON public.data_import_sessions
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR clinic_id IN (SELECT public.user_clinic_ids())
  );

DROP POLICY IF EXISTS data_import_sessions_insert ON public.data_import_sessions;
CREATE POLICY data_import_sessions_insert ON public.data_import_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR clinic_id IN (SELECT public.user_clinic_ids())
  );

DROP POLICY IF EXISTS data_import_sessions_update ON public.data_import_sessions;
CREATE POLICY data_import_sessions_update ON public.data_import_sessions
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR clinic_id IN (SELECT public.user_clinic_ids())
  )
  WITH CHECK (
    public.is_superadmin()
    OR clinic_id IN (SELECT public.user_clinic_ids())
  );

DROP POLICY IF EXISTS import_mapping_templates_select ON public.import_mapping_templates;
CREATE POLICY import_mapping_templates_select ON public.import_mapping_templates
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR clinic_id IN (SELECT public.user_clinic_ids())
  );

DROP POLICY IF EXISTS import_mapping_templates_write ON public.import_mapping_templates;
CREATE POLICY import_mapping_templates_write ON public.import_mapping_templates
  FOR ALL TO authenticated
  USING (
    public.is_superadmin()
    OR clinic_id IN (SELECT public.user_clinic_ids())
  )
  WITH CHECK (
    public.is_superadmin()
    OR clinic_id IN (SELECT public.user_clinic_ids())
  );

COMMENT ON TABLE public.data_import_sessions IS
  'Patient/clinical import wizard sessions. File bytes stay in storage; this row holds mapping, stats, and audit counters.';

COMMENT ON TABLE public.import_mapping_templates IS
  'Reusable spreadsheet column mappings per clinic (PAMI, OSDE, custom, etc.).';
