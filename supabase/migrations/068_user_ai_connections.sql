-- Per-user AI provider credentials (BYOK). Keys are server-only via RLS; never exposed to client after save.

CREATE TABLE IF NOT EXISTS public.user_ai_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'openai_compatible')),
  api_key TEXT NOT NULL,
  base_url TEXT,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_ai_connections_provider
  ON public.user_ai_connections (provider);

ALTER TABLE public.user_ai_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_ai_connections_select_own ON public.user_ai_connections;
CREATE POLICY user_ai_connections_select_own ON public.user_ai_connections
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_ai_connections_insert_own ON public.user_ai_connections;
CREATE POLICY user_ai_connections_insert_own ON public.user_ai_connections
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_ai_connections_update_own ON public.user_ai_connections;
CREATE POLICY user_ai_connections_update_own ON public.user_ai_connections
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_ai_connections_delete_own ON public.user_ai_connections;
CREATE POLICY user_ai_connections_delete_own ON public.user_ai_connections
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_ai_connections IS
  'User-owned AI provider API keys. Read/write restricted to owner; used server-side for copilot LLM calls.';
