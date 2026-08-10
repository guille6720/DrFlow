-- Database audit follow-up: targeted indexes for PAMI, pathology search, vademecum ILIKE,
-- and upcoming appointments. Idempotent. Multiclinica: all patient/appointment indexes lead with clinic_id.
-- Maps to load-pami-planillas-page, findPatientIdsByPathologySearch, search_pami_vademecum,
-- recordatorios/page, load-pacientes-page (cobertura=pami).

-- ---------------------------------------------------------------------------
-- 1. PAMI patient roster — filter insurance_provider ILIKE '%PAMI%' + order by name
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_patients_clinic_pami_active
  ON patients (clinic_id, last_name, first_name)
  WHERE is_active = true AND insurance_provider ILIKE '%PAMI%';

-- ---------------------------------------------------------------------------
-- 2. Clinical record pathology search (diagnosis / chief_complaint ILIKE tokens)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_clinical_records_diagnosis_trgm
  ON clinical_records USING gin (diagnosis gin_trgm_ops)
  WHERE diagnosis IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_records_chief_complaint_trgm
  ON clinical_records USING gin (chief_complaint gin_trgm_ops)
  WHERE chief_complaint IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. PAMI vademecum ILIKE search (search_pami_vademecum RPC)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pami_vademecum_brand_trgm
  ON pami_vademecum USING gin (brand_name gin_trgm_ops)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pami_vademecum_ingredient_trgm
  ON pami_vademecum USING gin (active_ingredient gin_trgm_ops)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 4. Upcoming active appointments (recordatorios, telemedicina pickers)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_upcoming_active
  ON appointments (clinic_id, start_at)
  WHERE status IN ('pending', 'confirmed');
