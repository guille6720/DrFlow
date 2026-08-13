-- Límite de 3 dispositivos concurrentes por usuario (misma cuenta).

CREATE TABLE IF NOT EXISTS user_device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_device_sessions_user_active
  ON user_device_sessions (user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE user_device_sessions IS
  'Sesiones de dispositivo para limitar a 3 conexiones concurrentes por usuario.';

ALTER TABLE user_device_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_device_sessions_select_own ON user_device_sessions;
CREATE POLICY user_device_sessions_select_own ON user_device_sessions FOR SELECT
  USING (is_superadmin() OR user_id = auth.uid());

DROP POLICY IF EXISTS user_device_sessions_update_own ON user_device_sessions;
CREATE POLICY user_device_sessions_update_own ON user_device_sessions FOR UPDATE
  USING (is_superadmin() OR user_id = auth.uid())
  WITH CHECK (is_superadmin() OR user_id = auth.uid());

-- Inserts / revokes se hacen vía RPC security definer.

CREATE OR REPLACE FUNCTION public.claim_user_device_session(
  p_session_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_max_sessions INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_session_id UUID;
  v_revoked UUID[] := ARRAY[]::UUID[];
  v_row user_device_sessions%ROWTYPE;
  v_keep INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_keep := GREATEST(COALESCE(p_max_sessions, 3), 1);

  -- Reusar sesión activa existente del mismo dispositivo.
  IF p_session_id IS NOT NULL THEN
    SELECT * INTO v_row
    FROM user_device_sessions
    WHERE id = p_session_id
      AND user_id = v_uid
      AND revoked_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      UPDATE user_device_sessions
      SET
        last_seen_at = now(),
        user_agent = COALESCE(NULLIF(trim(p_user_agent), ''), user_agent),
        ip_address = COALESCE(NULLIF(trim(p_ip_address), ''), ip_address)
      WHERE id = v_row.id;

      RETURN jsonb_build_object(
        'ok', true,
        'session_id', v_row.id,
        'reused', true,
        'revoked_ids', '[]'::jsonb
      );
    END IF;
  END IF;

  INSERT INTO user_device_sessions (user_id, user_agent, ip_address)
  VALUES (
    v_uid,
    NULLIF(trim(p_user_agent), ''),
    NULLIF(trim(p_ip_address), '')
  )
  RETURNING id INTO v_session_id;

  -- Mantener solo las N sesiones más recientes; revocar el resto.
  WITH ranked AS (
    SELECT id,
      row_number() OVER (ORDER BY last_seen_at DESC, created_at DESC) AS rn
    FROM user_device_sessions
    WHERE user_id = v_uid
      AND revoked_at IS NULL
  ),
  revoked AS (
    UPDATE user_device_sessions s
    SET revoked_at = now()
    FROM ranked r
    WHERE s.id = r.id
      AND r.rn > v_keep
    RETURNING s.id
  )
  SELECT coalesce(array_agg(id), ARRAY[]::UUID[]) INTO v_revoked FROM revoked;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'reused', false,
    'revoked_ids', to_jsonb(coalesce(v_revoked, ARRAY[]::UUID[]))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_user_device_session(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row user_device_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  SELECT * INTO v_row
  FROM user_device_sessions
  WHERE id = p_session_id
    AND user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;

  UPDATE user_device_sessions
  SET last_seen_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true, 'session_id', p_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_user_device_session(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE user_device_sessions
  SET revoked_at = coalesce(revoked_at, now())
  WHERE id = p_session_id
    AND user_id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_user_device_session(UUID, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_user_device_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_device_session(UUID) TO authenticated;
