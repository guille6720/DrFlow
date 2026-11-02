CREATE SCHEMA nexclinic_storage;
REVOKE ALL ON SCHEMA nexclinic_storage FROM PUBLIC;

CREATE TABLE nexclinic_storage.accounts (
  clinic_id uuid PRIMARY KEY,
  limit_bytes bigint CHECK (limit_bytes >= 0),
  baseline_bytes bigint NOT NULL CHECK (baseline_bytes >= 0),
  inventoried boolean NOT NULL DEFAULT false
);

CREATE TABLE nexclinic_storage.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES nexclinic_storage.accounts(clinic_id),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 1 AND 200),
  path text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (length(content_type) > 0),
  bytes bigint NOT NULL CHECK (bytes >= 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved', 'uncertain', 'verified')),
  UNIQUE (clinic_id, request_key),
  CHECK (split_part(path, '/', 1) = clinic_id::text),
  CHECK (path !~ '(^|/)(\.{1,2})?(/|$)' AND path !~ '[%\\]')
);

ALTER TABLE nexclinic_storage.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexclinic_storage.operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA nexclinic_storage FROM PUBLIC;

CREATE FUNCTION nexclinic_storage.reserve(
  clinic uuid, request_key text, object_path text, content_type text,
  byte_count bigint, digest text
) RETURNS nexclinic_storage.operations
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, nexclinic_storage AS $$
DECLARE
  account nexclinic_storage.accounts;
  existing nexclinic_storage.operations;
  charged numeric;
BEGIN
  SELECT * INTO account FROM nexclinic_storage.accounts WHERE clinic_id = clinic FOR UPDATE;
  IF NOT FOUND OR NOT account.inventoried THEN
    RAISE EXCEPTION 'STORAGE_INVENTORY_REQUIRED';
  END IF;
  IF byte_count IS NULL OR byte_count < 0 OR digest IS NULL OR digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'INVALID_STORAGE_OPERATION';
  END IF;
  SELECT * INTO existing FROM nexclinic_storage.operations operation
    WHERE operation.clinic_id = clinic AND operation.request_key = reserve.request_key;
  IF FOUND THEN
    IF existing.path IS DISTINCT FROM object_path OR existing.content_type IS DISTINCT FROM reserve.content_type
      OR existing.bytes IS DISTINCT FROM byte_count OR existing.sha256 IS DISTINCT FROM digest THEN
      RAISE EXCEPTION 'STORAGE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN existing;
  END IF;
  SELECT account.baseline_bytes::numeric + COALESCE(sum(bytes), 0)
    INTO charged FROM nexclinic_storage.operations WHERE clinic_id = clinic;
  IF account.limit_bytes IS NOT NULL AND charged + byte_count > account.limit_bytes THEN
    RAISE EXCEPTION 'STORAGE_CAPACITY_EXCEEDED';
  END IF;
  INSERT INTO nexclinic_storage.operations(clinic_id, request_key, path, content_type, bytes, sha256)
    VALUES (clinic, request_key, object_path, content_type, byte_count, digest) RETURNING * INTO existing;
  RETURN existing;
END;
$$;

CREATE FUNCTION nexclinic_storage.finish(operation_id uuid, byte_count bigint, digest text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, nexclinic_storage AS $$
DECLARE
  operation nexclinic_storage.operations;
BEGIN
  SELECT * INTO operation FROM nexclinic_storage.operations WHERE id = operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STORAGE_OPERATION_NOT_FOUND'; END IF;
  IF operation.bytes IS DISTINCT FROM byte_count OR operation.sha256 IS DISTINCT FROM digest THEN
    RAISE EXCEPTION 'STORAGE_INTEGRITY_MISMATCH';
  END IF;
  UPDATE nexclinic_storage.operations SET state = 'verified' WHERE id = operation_id;
END;
$$;

CREATE FUNCTION nexclinic_storage.mark_uncertain(operation_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = pg_catalog, nexclinic_storage AS $$
  UPDATE nexclinic_storage.operations SET state = 'uncertain'
    WHERE id = operation_id AND state = 'reserved';
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nexclinic_storage FROM PUBLIC;
