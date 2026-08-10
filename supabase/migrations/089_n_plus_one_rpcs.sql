-- N+1 reduction: single-round-trip pathology patient search (replaces per-token clinical_records queries).

CREATE OR REPLACE FUNCTION public.search_patient_ids_by_pathology(
  p_clinic_id UUID,
  p_query TEXT
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_q TEXT;
  v_token TEXT;
  v_tokens TEXT[];
  v_ids UUID[];
  v_token_ids UUID[];
BEGIN
  v_q := trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'));
  IF v_q = '' THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  IF length(v_q) > 80 THEN
    v_q := left(v_q, 80);
  END IF;

  v_tokens := regexp_split_to_array(v_q, '\s+');
  IF v_tokens IS NULL OR array_length(v_tokens, 1) IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  v_ids := NULL;

  FOREACH v_token IN ARRAY v_tokens LOOP
    IF v_token IS NULL OR v_token = '' THEN
      CONTINUE;
    END IF;

    SELECT coalesce(array_agg(DISTINCT cr.patient_id), ARRAY[]::UUID[])
    INTO v_token_ids
    FROM clinical_records cr
    WHERE cr.clinic_id = p_clinic_id
      AND (
        coalesce(cr.diagnosis, '') ILIKE '%' || public.escape_ilike_pattern(v_token) || '%'
        OR coalesce(cr.chief_complaint, '') ILIKE '%' || public.escape_ilike_pattern(v_token) || '%'
      );

    IF coalesce(array_length(v_token_ids, 1), 0) = 0 THEN
      RETURN ARRAY[]::UUID[];
    END IF;

    IF v_ids IS NULL THEN
      v_ids := v_token_ids;
    ELSE
      SELECT coalesce(array_agg(id), ARRAY[]::UUID[])
      INTO v_ids
      FROM unnest(v_ids) AS id
      WHERE id = ANY (v_token_ids);
    END IF;

    IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
      RETURN ARRAY[]::UUID[];
    END IF;
  END LOOP;

  RETURN coalesce(v_ids, ARRAY[]::UUID[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_patient_ids_by_pathology(UUID, TEXT) TO authenticated;
