-- Phase 2 import/export: metadata for historical clinical documents.
-- Files stay in clinical-files; no SOAP/diagnosis extraction.
-- Backward compatible: application retries insert without these columns if absent.

ALTER TABLE public.patient_attachments
  ADD COLUMN IF NOT EXISTS document_date DATE;

ALTER TABLE public.patient_attachments
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE public.patient_attachments
  ADD COLUMN IF NOT EXISTS professional_id UUID
    REFERENCES public.professionals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_attachments_clinic_document_date
  ON public.patient_attachments (clinic_id, patient_id, document_date DESC)
  WHERE document_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_attachments_clinic_professional
  ON public.patient_attachments (clinic_id, professional_id)
  WHERE professional_id IS NOT NULL;

COMMENT ON COLUMN public.patient_attachments.document_date IS
  'Clinical date of the historical document (not upload time).';

COMMENT ON COLUMN public.patient_attachments.source IS
  'Origin of the document (previous system, paper scan, external clinic). No file bytes.';

COMMENT ON COLUMN public.patient_attachments.professional_id IS
  'Optional professional associated with the historical document.';
