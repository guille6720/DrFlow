-- 160: Generic profile-ref nullify must skip immutable / protected tables.
-- Catch-all loop wraps each UPDATE so consent/audit/etc. cannot abort Auth delete.

CREATE OR REPLACE FUNCTION public._nullify_all_nullable_profile_refs(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT
      rel.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace AND n.nspname = 'public'
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    JOIN information_schema.columns cols
      ON cols.table_schema = 'public'
     AND cols.table_name = rel.relname
     AND cols.column_name = a.attname
     AND cols.is_nullable = 'YES'
    WHERE c.contype = 'f'
      AND ref.relname = 'profiles'
      -- Handled separately / must remain for legal retention.
      AND rel.relname NOT IN (
        'audit_logs',
        'clinical_record_audit',
        'consent_records',
        'informed_consents',
        'privacy_rights_requests'
      )
  LOOP
    BEGIN
      EXECUTE format(
        'UPDATE public.%I SET %I = NULL WHERE %I = $1',
        r.table_name,
        r.column_name,
        r.column_name
      )
      USING p_user_id;
    EXCEPTION
      WHEN others THEN
        -- Skip tables protected by immutability triggers.
        NULL;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._nullify_all_nullable_profile_refs(UUID) FROM PUBLIC;

-- Also drop explicit nullify of consent recorded_by from cleanup if present in body —
-- recreate cleanup to remove informed_consents / privacy / consent from the explicit list
-- is heavy; the exception wrapper above is enough for the catch-all. Explicit list in 159
-- still has informed_consents.recorded_by and privacy_rights — neutralize those helpers
-- via exception-safe wrapper on _nullify_profile_ref.

CREATE OR REPLACE FUNCTION public._nullify_profile_ref(
  p_table text,
  p_column text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass(format('public.%I', p_table)) IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = p_table
      AND c.column_name = p_column
  ) THEN
    RETURN;
  END IF;

  BEGIN
    EXECUTE format(
      'UPDATE public.%I SET %I = NULL WHERE %I = $1',
      p_table,
      p_column,
      p_column
    )
    USING p_user_id;
  EXCEPTION
    WHEN others THEN
      NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public._nullify_profile_ref(text, text, uuid) FROM PUBLIC;

-- When Auth hard-delete is blocked by immutable legal rows, free the original email
-- by rewriting Auth + profile to a tombstone address (HC/professional preserved).
CREATE OR REPLACE FUNCTION public.release_auth_email_for_deleted_user(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_new TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_email LIKE 'deleted.%@deleted.nexclinic.invalid' THEN
    RETURN NULL;
  END IF;

  v_new := 'deleted.' || replace(p_user_id::text, '-', '') || '@deleted.nexclinic.invalid';

  UPDATE auth.users
  SET
    email = v_new,
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('original_email', v_email, 'deleted_at', now()),
    updated_at = now(),
    banned_until = '2099-01-01'::timestamptz
  WHERE id = p_user_id;

  UPDATE auth.identities
  SET
    identity_data = COALESCE(identity_data, '{}'::jsonb)
      || jsonb_build_object('email', v_new, 'original_email', v_email),
    provider_id = CASE WHEN provider = 'email' THEN v_new ELSE provider_id END,
    updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE profiles
  SET
    email = v_new,
    original_email = COALESCE(original_email, v_email),
    account_status = 'deleted',
    deleted_at = COALESCE(deleted_at, now()),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.release_auth_email_for_deleted_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_auth_email_for_deleted_user(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
