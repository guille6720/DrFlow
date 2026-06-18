-- Invitaciones de equipo (médicos, secretaría, admins)

CREATE TABLE IF NOT EXISTS clinic_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  invited_by UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (clinic_id, email)
);

DO $$ BEGIN
  ALTER TABLE clinic_invitations
    ADD CONSTRAINT clinic_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'revoked'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinic_invitations_email
  ON clinic_invitations(lower(email), status);

ALTER TABLE clinic_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_invitations_admin ON clinic_invitations;
CREATE POLICY clinic_invitations_admin ON clinic_invitations FOR ALL
  USING (can_manage_clinic(clinic_id));

-- Al iniciar sesión, acepta invitaciones pendientes para el email del usuario
CREATE OR REPLACE FUNCTION public.accept_clinic_invitations_for_user()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_count INTEGER := 0;
  inv RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(p.email, u.email) INTO v_email
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = v_user_id;

  IF v_email IS NULL OR trim(v_email) = '' THEN
    RETURN 0;
  END IF;

  FOR inv IN
    SELECT * FROM clinic_invitations
    WHERE lower(trim(email)) = lower(trim(v_email))
      AND status = 'pending'
  LOOP
    INSERT INTO clinic_members (clinic_id, user_id, role, is_active)
    VALUES (inv.clinic_id, v_user_id, inv.role, true)
    ON CONFLICT (clinic_id, user_id) DO UPDATE
      SET role = EXCLUDED.role, is_active = true, updated_at = now();

    UPDATE clinic_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = inv.id;

    UPDATE profiles
    SET full_name = COALESCE(NULLIF(trim(full_name), ''), inv.full_name),
        updated_at = now()
    WHERE id = v_user_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_clinic_invitations_for_user TO authenticated;
