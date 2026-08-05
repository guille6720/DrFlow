-- Allow Google Gemini as a BYOK provider for user_ai_connections.

ALTER TABLE public.user_ai_connections
  DROP CONSTRAINT IF EXISTS user_ai_connections_provider_check;

ALTER TABLE public.user_ai_connections
  ADD CONSTRAINT user_ai_connections_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'openai_compatible', 'gemini'));
