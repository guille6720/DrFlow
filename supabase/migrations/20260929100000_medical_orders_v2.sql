-- Medical Orders v2 (Órdenes Médicas) — extends the existing public.medical_orders table.
-- Additive and backward compatible:
--   * Existing rows (order_category IS NULL, "legacy" study/referral/pami_form orders) keep working exactly as before
--     (editable while issued, no number, no token). No existing row is modified by this migration.
--   * New structured orders (order_category IS NOT NULL) get: server-side number (OM-YYYY-########, per clinic,
--     concurrency safe), random public verification token, issuer/patient snapshots, document hash, immutability once
--     issued (only annulment with reason), items table and a study catalog.
--   * Internal validation only: this is NOT a qualified digital signature nor an official e-prescription registration.
--     external_* columns are integration points for future authorized providers (ReNaPDiS-compatible, CUIR, etc.).
-- Rollback: rollback/20260929100000_medical_orders_v2.down.sql

-- ---------------------------------------------------------------------------
-- 1. Columns on medical_orders (all nullable → no rewrite, legacy rows untouched)
-- ---------------------------------------------------------------------------
ALTER TABLE public.medical_orders
  ADD COLUMN IF NOT EXISTS order_category TEXT,
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS public_verification_token TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_text TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_code TEXT,
  ADD COLUMN IF NOT EXISTS clinical_indication TEXT,
  ADD COLUMN IF NOT EXISTS preparation_instructions TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS patient_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS issuer_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS document_hash TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS external_provider TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT,
  ADD COLUMN IF NOT EXISTS external_status TEXT;

ALTER TABLE public.medical_orders DROP CONSTRAINT IF EXISTS medical_orders_order_category_check;
ALTER TABLE public.medical_orders ADD CONSTRAINT medical_orders_order_category_check CHECK (
  order_category IS NULL OR order_category IN (
    'laboratorio', 'imagenes', 'interconsulta', 'practica',
    'kinesiologia', 'psicologia', 'dispositivo', 'otra'
  )
);

ALTER TABLE public.medical_orders DROP CONSTRAINT IF EXISTS medical_orders_priority_check;
ALTER TABLE public.medical_orders ADD CONSTRAINT medical_orders_priority_check CHECK (
  priority IS NULL OR priority IN ('normal', 'preferente', 'urgente')
);

ALTER TABLE public.medical_orders DROP CONSTRAINT IF EXISTS medical_orders_void_reason_len;
ALTER TABLE public.medical_orders ADD CONSTRAINT medical_orders_void_reason_len CHECK (
  void_reason IS NULL OR char_length(void_reason) <= 500
);

ALTER TABLE public.medical_orders DROP CONSTRAINT IF EXISTS medical_orders_token_format;
ALTER TABLE public.medical_orders ADD CONSTRAINT medical_orders_token_format CHECK (
  public_verification_token IS NULL OR public_verification_token ~ '^[0-9a-f]{64}$'
);

COMMENT ON COLUMN public.medical_orders.order_category IS
  'Órdenes v2: laboratorio|imagenes|interconsulta|practica|kinesiologia|psicologia|dispositivo|otra. NULL = orden legacy.';
COMMENT ON COLUMN public.medical_orders.order_number IS
  'OM-YYYY-######## asignado por trigger al emitir (por clínica, sin reutilización).';
COMMENT ON COLUMN public.medical_orders.public_verification_token IS
  'Token aleatorio (64 hex) para /verify/medical-order/{token}. No es el UUID interno.';
COMMENT ON COLUMN public.medical_orders.issuer_snapshot IS
  'Validación interna NexClinic (profesional, matrícula, usuario, clínica, timestamp). No es firma digital calificada.';
COMMENT ON COLUMN public.medical_orders.external_provider IS
  'Punto de integración futuro con proveedores autorizados de receta/orden electrónica. No se usa todavía.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_orders_clinic_number
  ON public.medical_orders (clinic_id, order_number) WHERE order_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_orders_verification_token
  ON public.medical_orders (public_verification_token) WHERE public_verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medical_orders_clinic_issued
  ON public.medical_orders (clinic_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_orders_clinic_professional
  ON public.medical_orders (clinic_id, professional_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_orders_clinic_status
  ON public.medical_orders (clinic_id, status, issued_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Per-clinic yearly counters (no client access; used only by the trigger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_order_counters (
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_value BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (clinic_id, year)
);
ALTER TABLE public.medical_order_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_order_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.medical_order_counters TO service_role;

CREATE OR REPLACE FUNCTION public.next_medical_order_number(p_clinic_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'))::INTEGER;
  v_n BIGINT;
BEGIN
  INSERT INTO public.medical_order_counters (clinic_id, year, last_value)
  VALUES (p_clinic_id, v_year, 1)
  ON CONFLICT (clinic_id, year)
  DO UPDATE SET last_value = public.medical_order_counters.last_value + 1
  RETURNING last_value INTO v_n;
  RETURN format('OM-%s-%s', v_year, lpad(v_n::TEXT, 8, '0'));
END;
$$;
REVOKE ALL ON FUNCTION public.next_medical_order_number(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_medical_order_number(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  medical_order_id UUID NOT NULL REFERENCES public.medical_orders(id) ON DELETE CASCADE,
  category TEXT,
  code TEXT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 300),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medical_order_items_order
  ON public.medical_order_items (medical_order_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_medical_order_items_clinic
  ON public.medical_order_items (clinic_id);

ALTER TABLE public.medical_order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_order_items TO authenticated;
GRANT ALL ON public.medical_order_items TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Catalog (global rows clinic_id IS NULL; clinics may add their own later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_order_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  order_category TEXT NOT NULL,
  group_label TEXT,
  code TEXT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT medical_order_catalog_category_check CHECK (order_category IN (
    'laboratorio', 'imagenes', 'interconsulta', 'practica',
    'kinesiologia', 'psicologia', 'dispositivo', 'otra'
  ))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_order_catalog_unique
  ON public.medical_order_catalog (
    COALESCE(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid), order_category, lower(name)
  );
CREATE INDEX IF NOT EXISTS idx_medical_order_catalog_lookup
  ON public.medical_order_catalog (order_category, is_active, sort_order);

ALTER TABLE public.medical_order_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_order_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.medical_order_catalog TO authenticated;
GRANT ALL ON public.medical_order_catalog TO service_role;

DROP POLICY IF EXISTS medical_order_catalog_select ON public.medical_order_catalog;
CREATE POLICY medical_order_catalog_select ON public.medical_order_catalog
  FOR SELECT TO authenticated
  USING (clinic_id IS NULL OR public.is_superadmin() OR clinic_id IN (SELECT public.user_clinic_ids()));

DROP POLICY IF EXISTS medical_order_catalog_insert ON public.medical_order_catalog;
CREATE POLICY medical_order_catalog_insert ON public.medical_order_catalog
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id IS NOT NULL
    AND (public.is_superadmin() OR public.user_role_in_clinic(clinic_id) = 'clinic_admin')
  );

DROP POLICY IF EXISTS medical_order_catalog_update ON public.medical_order_catalog;
CREATE POLICY medical_order_catalog_update ON public.medical_order_catalog
  FOR UPDATE TO authenticated
  USING (
    clinic_id IS NOT NULL
    AND (public.is_superadmin() OR public.user_role_in_clinic(clinic_id) = 'clinic_admin')
  )
  WITH CHECK (
    clinic_id IS NOT NULL
    AND (public.is_superadmin() OR public.user_role_in_clinic(clinic_id) = 'clinic_admin')
  );

INSERT INTO public.medical_order_catalog (clinic_id, order_category, group_label, name, sort_order)
SELECT NULL, v.cat, v.grp, v.name, v.ord
FROM (VALUES
  ('laboratorio', 'Hematología', 'Hemograma completo', 10),
  ('laboratorio', 'Hematología', 'Eritrosedimentación', 11),
  ('laboratorio', 'Hematología', 'Coagulograma', 12),
  ('laboratorio', 'Glucemia / Metabolismo', 'Glucemia', 20),
  ('laboratorio', 'Glucemia / Metabolismo', 'Hemoglobina glicosilada', 21),
  ('laboratorio', 'Glucemia / Metabolismo', 'Insulina', 22),
  ('laboratorio', 'Perfil lipídico', 'Colesterol total', 30),
  ('laboratorio', 'Perfil lipídico', 'HDL', 31),
  ('laboratorio', 'Perfil lipídico', 'LDL', 32),
  ('laboratorio', 'Perfil lipídico', 'Triglicéridos', 33),
  ('laboratorio', 'Función renal', 'Urea', 40),
  ('laboratorio', 'Función renal', 'Creatinina', 41),
  ('laboratorio', 'Función renal', 'Ionograma', 42),
  ('laboratorio', 'Hepatograma', 'GOT / AST', 50),
  ('laboratorio', 'Hepatograma', 'GPT / ALT', 51),
  ('laboratorio', 'Hepatograma', 'Fosfatasa alcalina', 52),
  ('laboratorio', 'Hepatograma', 'Bilirrubina', 53),
  ('laboratorio', 'Tiroides', 'TSH', 60),
  ('laboratorio', 'Tiroides', 'T4', 61),
  ('laboratorio', 'Tiroides', 'T4 libre', 62),
  ('laboratorio', 'Orina', 'Orina completa', 70),
  ('imagenes', 'Modalidad', 'Radiografía', 10),
  ('imagenes', 'Modalidad', 'Ecografía', 20),
  ('imagenes', 'Modalidad', 'Tomografía computada', 30),
  ('imagenes', 'Modalidad', 'Resonancia magnética', 40),
  ('imagenes', 'Modalidad', 'Mamografía', 50),
  ('imagenes', 'Modalidad', 'Ecografía Doppler', 60),
  ('imagenes', 'Modalidad', 'Densitometría ósea', 70),
  ('interconsulta', 'Especialidad', 'Cardiología', 10),
  ('interconsulta', 'Especialidad', 'Traumatología', 20),
  ('interconsulta', 'Especialidad', 'Neurología', 30),
  ('interconsulta', 'Especialidad', 'Oftalmología', 40),
  ('interconsulta', 'Especialidad', 'Dermatología', 50),
  ('interconsulta', 'Especialidad', 'Endocrinología', 60),
  ('interconsulta', 'Especialidad', 'Gastroenterología', 70),
  ('interconsulta', 'Especialidad', 'Ginecología', 80),
  ('practica', 'Práctica', 'Electrocardiograma', 10),
  ('practica', 'Práctica', 'Ergometría', 20),
  ('practica', 'Práctica', 'Holter 24 hs', 30),
  ('practica', 'Práctica', 'Espirometría', 40),
  ('kinesiologia', 'Sesiones', 'Kinesiología motora (10 sesiones)', 10),
  ('kinesiologia', 'Sesiones', 'Kinesiología respiratoria (10 sesiones)', 20),
  ('kinesiologia', 'Sesiones', 'Rehabilitación postquirúrgica', 30),
  ('psicologia', 'Tratamiento', 'Psicoterapia individual', 10),
  ('psicologia', 'Tratamiento', 'Evaluación psicológica', 20),
  ('psicologia', 'Tratamiento', 'Psicoterapia familiar', 30),
  ('dispositivo', 'Insumo', 'Nebulizador', 10),
  ('dispositivo', 'Insumo', 'Tensiómetro', 20),
  ('dispositivo', 'Insumo', 'Plantillas ortopédicas', 30)
) AS v(cat, grp, name, ord)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Secretary read access only when explicitly granted (clinic role/member permission viewMedicalOrders)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_medical_orders(p_clinic_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_view_clinical(p_clinic_id) OR EXISTS (
    SELECT 1
    FROM public.clinic_members m
    WHERE m.clinic_id = p_clinic_id
      AND m.user_id = auth.uid()
      AND m.is_active
      AND m.role = 'secretary'
      AND COALESCE(
        (SELECT cmp.granted FROM public.clinic_member_permissions cmp
          WHERE cmp.member_id = m.id AND cmp.permission_key = 'viewMedicalOrders' LIMIT 1),
        (SELECT crp.granted FROM public.clinic_role_permissions crp
          WHERE crp.clinic_id = p_clinic_id AND crp.role = 'secretary'
            AND crp.permission_key = 'viewMedicalOrders' LIMIT 1),
        false
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_medical_orders(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_medical_orders(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS medical_orders_select ON public.medical_orders;
CREATE POLICY medical_orders_select ON public.medical_orders FOR SELECT
  USING (public.is_superadmin() OR public.can_view_medical_orders(clinic_id));

DROP POLICY IF EXISTS medical_order_items_select ON public.medical_order_items;
CREATE POLICY medical_order_items_select ON public.medical_order_items FOR SELECT TO authenticated
  USING (public.is_superadmin() OR public.can_view_medical_orders(clinic_id));

DROP POLICY IF EXISTS medical_order_items_insert ON public.medical_order_items;
CREATE POLICY medical_order_items_insert ON public.medical_order_items FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR public.can_write_clinical(clinic_id));

DROP POLICY IF EXISTS medical_order_items_update ON public.medical_order_items;
CREATE POLICY medical_order_items_update ON public.medical_order_items FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR public.can_write_clinical(clinic_id))
  WITH CHECK (public.is_superadmin() OR public.can_write_clinical(clinic_id));

DROP POLICY IF EXISTS medical_order_items_delete ON public.medical_order_items;
CREATE POLICY medical_order_items_delete ON public.medical_order_items FOR DELETE TO authenticated
  USING (public.is_superadmin() OR public.can_write_clinical(clinic_id));

-- ---------------------------------------------------------------------------
-- 6. Guards: numbering, snapshots, hash, immutability, anti-impersonation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.medical_order_content_hash(p_order public.medical_orders)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'number', p_order.order_number,
    'clinic', p_order.clinic_id,
    'patient', p_order.patient_id,
    'professional', p_order.professional_id,
    'category', p_order.order_category,
    'text', p_order.order_text,
    'diagnosis', p_order.diagnosis_text,
    'diagnosis_code', p_order.diagnosis_code,
    'indication', p_order.clinical_indication,
    'notes', p_order.notes,
    'preparation', p_order.preparation_instructions,
    'priority', p_order.priority,
    'valid_until', p_order.valid_until,
    'issued_at', p_order.issued_at,
    'items', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'category', i.category, 'code', i.code, 'name', i.name,
        'description', i.description, 'metadata', i.metadata
      ) ORDER BY i.sort_order, i.name), '[]'::jsonb)
      FROM public.medical_order_items i WHERE i.medical_order_id = p_order.id
    )
  )::TEXT, 'UTF8')), 'hex');
$$;
REVOKE ALL ON FUNCTION public.medical_order_content_hash(public.medical_orders) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.medical_orders_v2_issue(p_row public.medical_orders)
RETURNS public.medical_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pro RECORD;
  v_patient RECORD;
  v_clinic RECORD;
  v_is_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  v_cov JSONB := COALESCE(p_row.patient_snapshot, '{}'::jsonb);
BEGIN
  SELECT p.id, p.clinic_id, p.user_id, p.display_name, p.license_number, p.license_national,
         p.license_provincial, p.licensing_jurisdiction, s.name AS specialty, pr.full_name
    INTO v_pro
  FROM public.professionals p
  LEFT JOIN public.specialties s ON s.id = p.specialty_id
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.id = p_row.professional_id;

  IF NOT FOUND OR v_pro.clinic_id IS DISTINCT FROM p_row.clinic_id THEN
    RAISE EXCEPTION 'MEDICAL_ORDER_PROFESSIONAL_INVALID';
  END IF;

  -- Anti-impersonation: the issuer must be the logged-in user's own professional record.
  IF NOT v_is_service THEN
    IF auth.uid() IS NULL OR NOT (
      COALESCE(v_pro.user_id = auth.uid(), false)
      OR EXISTS (
        SELECT 1 FROM public.clinic_members m
        WHERE m.clinic_id = p_row.clinic_id AND m.user_id = auth.uid()
          AND m.is_active AND m.professional_id = p_row.professional_id
      )
    ) THEN
      RAISE EXCEPTION 'MEDICAL_ORDER_ISSUER_MISMATCH';
    END IF;
  END IF;

  SELECT first_name, last_name, document_type, document_number, birth_date, sex,
         insurance_provider, insurance_plan, insurance_number, clinic_id
    INTO v_patient
  FROM public.patients WHERE id = p_row.patient_id;
  IF NOT FOUND OR v_patient.clinic_id IS DISTINCT FROM p_row.clinic_id THEN
    RAISE EXCEPTION 'MEDICAL_ORDER_PATIENT_INVALID';
  END IF;

  SELECT name, address, phone, email INTO v_clinic FROM public.clinics WHERE id = p_row.clinic_id;

  p_row.issued_at := now();
  p_row.order_number := public.next_medical_order_number(p_row.clinic_id);
  p_row.public_verification_token :=
    replace(gen_random_uuid()::TEXT, '-', '') || replace(gen_random_uuid()::TEXT, '-', '');
  p_row.priority := COALESCE(p_row.priority, 'normal');
  p_row.patient_snapshot := jsonb_build_object(
    'first_name', v_patient.first_name,
    'last_name', v_patient.last_name,
    'document_type', v_patient.document_type,
    'document_number', v_patient.document_number,
    'birth_date', v_patient.birth_date,
    'sex', v_patient.sex,
    'insurance_provider', COALESCE(NULLIF(v_cov->>'insurance_provider', ''), v_patient.insurance_provider),
    'insurance_plan', COALESCE(NULLIF(v_cov->>'insurance_plan', ''), v_patient.insurance_plan),
    'insurance_number', COALESCE(NULLIF(v_cov->>'insurance_number', ''), v_patient.insurance_number)
  );
  p_row.issuer_snapshot := jsonb_build_object(
    'mechanism', 'nexclinic_internal_validation_v1',
    'professional_id', v_pro.id,
    'full_name', COALESCE(NULLIF(v_pro.display_name, ''), v_pro.full_name),
    'specialty', v_pro.specialty,
    'license_number', v_pro.license_number,
    'license_national', v_pro.license_national,
    'license_provincial', v_pro.license_provincial,
    'licensing_jurisdiction', v_pro.licensing_jurisdiction,
    'issued_by_user_id', auth.uid(),
    'clinic_id', p_row.clinic_id,
    'clinic_name', v_clinic.name,
    'clinic_address', v_clinic.address,
    'clinic_phone', v_clinic.phone,
    'clinic_email', v_clinic.email,
    'issued_at', p_row.issued_at
  );
  p_row.document_hash := public.medical_order_content_hash(p_row);
  RETURN p_row;
END;
$$;
REVOKE ALL ON FUNCTION public.medical_orders_v2_issue(public.medical_orders) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.medical_orders_v2_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Non-document bookkeeping that existing helpers may touch (date re-sync, user-deletion reassignment).
  v_ignore TEXT[] := ARRAY['updated_at', 'version', 'created_at', 'issued_at', 'created_by', 'voided_by'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Server-assigned fields can never come from the client.
    NEW.order_number := NULL;
    NEW.public_verification_token := NULL;
    NEW.issuer_snapshot := NULL;
    NEW.document_hash := NULL;
    NEW.voided_at := NULL;
    NEW.voided_by := NULL;
    IF NEW.order_category IS NULL THEN
      RETURN NEW; -- legacy order: unchanged behavior
    END IF;
    IF NEW.status NOT IN ('draft', 'issued') THEN
      RAISE EXCEPTION 'MEDICAL_ORDER_INVALID_STATUS';
    END IF;
    IF NEW.status = 'issued' THEN
      NEW := public.medical_orders_v2_issue(NEW);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.order_category IS NULL THEN
    IF NEW.order_category IS NOT NULL THEN
      RAISE EXCEPTION 'MEDICAL_ORDER_CATEGORY_IMMUTABLE';
    END IF;
    RETURN NEW; -- legacy order: unchanged behavior
  END IF;

  IF NEW.order_category IS DISTINCT FROM OLD.order_category THEN
    RAISE EXCEPTION 'MEDICAL_ORDER_CATEGORY_IMMUTABLE';
  END IF;

  IF OLD.status = 'draft' THEN
    NEW.order_number := NULL;
    NEW.public_verification_token := NULL;
    NEW.issuer_snapshot := NULL;
    NEW.document_hash := NULL;
    IF NEW.status = 'issued' THEN
      NEW := public.medical_orders_v2_issue(NEW);
    ELSIF NEW.status = 'void' THEN
      NEW.voided_at := now();
      NEW.voided_by := auth.uid();
    END IF;
    RETURN NEW;
  END IF;

  -- Issued / void: dates may be re-synced by legacy helpers, but the document keeps its original values.
  IF (to_jsonb(NEW) - v_ignore) = (to_jsonb(OLD) - v_ignore) THEN
    NEW.issued_at := OLD.issued_at;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  IF OLD.status = 'issued' AND NEW.status = 'void'
     AND (to_jsonb(NEW) - (v_ignore || ARRAY['status', 'voided_at', 'void_reason']))
       = (to_jsonb(OLD) - (v_ignore || ARRAY['status', 'voided_at', 'void_reason'])) THEN
    IF NEW.void_reason IS NULL OR btrim(NEW.void_reason) = '' THEN
      RAISE EXCEPTION 'MEDICAL_ORDER_VOID_REASON_REQUIRED';
    END IF;
    NEW.void_reason := btrim(NEW.void_reason);
    NEW.voided_at := now();
    NEW.voided_by := auth.uid();
    NEW.issued_at := OLD.issued_at;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'MEDICAL_ORDER_IMMUTABLE';
END;
$$;
REVOKE ALL ON FUNCTION public.medical_orders_v2_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_medical_orders_v2_guard ON public.medical_orders;
CREATE TRIGGER trg_medical_orders_v2_guard
  BEFORE INSERT OR UPDATE ON public.medical_orders
  FOR EACH ROW EXECUTE FUNCTION public.medical_orders_v2_guard();

CREATE OR REPLACE FUNCTION public.medical_orders_v2_prevent_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.order_category IS NULL OR OLD.status = 'draft' THEN
    RETURN OLD;
  END IF;
  IF COALESCE(current_setting('app.allow_clinical_hard_delete', true), 'false') = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'MEDICAL_ORDER_DELETE_FORBIDDEN: issued medical orders are annulled, never deleted.'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_medical_orders_v2_prevent_delete ON public.medical_orders;
CREATE TRIGGER trg_medical_orders_v2_prevent_delete
  BEFORE DELETE ON public.medical_orders
  FOR EACH ROW EXECUTE FUNCTION public.medical_orders_v2_prevent_delete();

CREATE OR REPLACE FUNCTION public.medical_order_items_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.medical_order_id ELSE NEW.medical_order_id END;
  v_parent RECORD;
BEGIN
  SELECT clinic_id, status, order_category INTO v_parent
  FROM public.medical_orders WHERE id = v_order_id;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; -- parent cascade
    RAISE EXCEPTION 'MEDICAL_ORDER_NOT_FOUND';
  END IF;

  IF v_parent.status <> 'draft'
     AND COALESCE(current_setting('app.allow_clinical_hard_delete', true), 'false') <> 'true' THEN
    RAISE EXCEPTION 'MEDICAL_ORDER_IMMUTABLE';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  NEW.clinic_id := v_parent.clinic_id;
  NEW.medical_order_id := v_order_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.medical_order_items_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_medical_order_items_guard ON public.medical_order_items;
CREATE TRIGGER trg_medical_order_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.medical_order_items
  FOR EACH ROW EXECUTE FUNCTION public.medical_order_items_guard();

-- ---------------------------------------------------------------------------
-- 7. Public verification (minimum data, masked patient)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_medical_order(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  v_items JSONB;
  v_doc TEXT;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT o.id, o.order_number, o.order_category, o.status, o.issued_at, o.valid_until, o.voided_at,
         o.patient_snapshot, o.issuer_snapshot, c.name AS clinic_name
    INTO v
  FROM public.medical_orders o
  JOIN public.clinics c ON c.id = o.clinic_id
  WHERE o.public_verification_token = p_token
    AND o.order_category IS NOT NULL
    AND o.status IN ('issued', 'void');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Only the count: study names can reveal sensitive diagnoses to whoever holds the QR.
  SELECT to_jsonb(count(*)) INTO v_items FROM public.medical_order_items WHERE medical_order_id = v.id;

  v_doc := COALESCE(v.patient_snapshot->>'document_number', '');

  RETURN jsonb_build_object(
    'found', true,
    'order_number', v.order_number,
    'status', CASE WHEN v.status = 'void' THEN 'anulada' ELSE 'valida' END,
    'expired', v.status = 'issued' AND v.valid_until IS NOT NULL AND v.valid_until < current_date,
    'order_category', v.order_category,
    'items_count', v_items,
    'patient_initials',
      upper(left(COALESCE(v.patient_snapshot->>'first_name', ''), 1)) || '.' ||
      upper(left(COALESCE(v.patient_snapshot->>'last_name', ''), 1)) || '.',
    'patient_document_masked',
      CASE WHEN length(v_doc) > 3 THEN repeat('•', 3) || right(v_doc, 3) ELSE NULL END,
    'professional_name', v.issuer_snapshot->>'full_name',
    'professional_license', COALESCE(
      NULLIF(v.issuer_snapshot->>'license_national', ''),
      NULLIF(v.issuer_snapshot->>'license_provincial', ''),
      NULLIF(v.issuer_snapshot->>'license_number', '')
    ),
    'issued_at', v.issued_at,
    'valid_until', v.valid_until,
    'voided_at', v.voided_at,
    'clinic_name', v.clinic_name
  );
END;
$$;
REVOKE ALL ON FUNCTION public.verify_medical_order(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_medical_order(TEXT) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. RBAC: new manageable permission keys for the per-clinic role matrix
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clinic_manageable_permission_keys()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'manageAppointments', 'managePatients', 'managePatientsAdmin', 'viewClinicalRecords',
    'viewPharmacology', 'editClinicalRecords', 'issuePrescriptions', 'viewReports',
    'managePayments', 'manageCashRegister', 'manageWaitingRoom', 'manageAdminDocuments',
    'importPatients', 'exportPatients', 'importClinicalRecords', 'exportClinicalRecords',
    'bulkExportData', 'viewGeriatrics', 'manageGeriatrics',
    'viewMedicalOrders', 'issueMedicalOrders', 'cancelMedicalOrders', 'shareMedicalOrders'
  ]::TEXT[];
$$;

NOTIFY pgrst, 'reload schema';
