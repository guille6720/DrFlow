-- Per-member permission overrides and clinic-wide shared AI credentials (admin-managed).

CREATE TABLE IF NOT EXISTS public.clinic_member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.clinic_members(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_clinic_member_permissions_clinic
  ON public.clinic_member_permissions (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_member_permissions_member
  ON public.clinic_member_permissions (member_id);

ALTER TABLE public.clinic_members
  ADD COLUMN IF NOT EXISTS uses_shared_ai BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.clinic_shared_ai_connections (
  clinic_id UUID PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'openai_compatible', 'gemini')),
  api_key TEXT NOT NULL,
  base_url TEXT,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  label TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_member_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_shared_ai_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_member_permissions_select ON public.clinic_member_permissions;
CREATE POLICY clinic_member_permissions_select ON public.clinic_member_permissions
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_role_in_clinic(clinic_id) = 'clinic_admin'
    OR EXISTS (
      SELECT 1
      FROM public.clinic_members cm
      WHERE cm.id = member_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
    )
  );

DROP POLICY IF EXISTS clinic_member_permissions_manage ON public.clinic_member_permissions;
CREATE POLICY clinic_member_permissions_manage ON public.clinic_member_permissions
  FOR ALL TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_role_in_clinic(clinic_id) = 'clinic_admin'
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

DROP POLICY IF EXISTS clinic_shared_ai_select ON public.clinic_shared_ai_connections;
CREATE POLICY clinic_shared_ai_select ON public.clinic_shared_ai_connections
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_role_in_clinic(clinic_id) = 'clinic_admin'
    OR EXISTS (
      SELECT 1
      FROM public.clinic_members cm
      WHERE cm.clinic_id = clinic_shared_ai_connections.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.uses_shared_ai = true
    )
  );

DROP POLICY IF EXISTS clinic_shared_ai_manage ON public.clinic_shared_ai_connections;
CREATE POLICY clinic_shared_ai_manage ON public.clinic_shared_ai_connections
  FOR ALL TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_role_in_clinic(clinic_id) = 'clinic_admin'
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.user_role_in_clinic(clinic_id) = 'clinic_admin'
  );

COMMENT ON TABLE public.clinic_member_permissions IS
  'Per-member permission overrides. When set, overrides the default role matrix in the app layer.';
COMMENT ON TABLE public.clinic_shared_ai_connections IS
  'Clinic-wide AI provider credentials configured by clinic_admin for shared staff use.';
COMMENT ON COLUMN public.clinic_members.uses_shared_ai IS
  'When true, the member uses clinic_shared_ai_connections instead of user_ai_connections.';
