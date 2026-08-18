# 005 — Import / export phase 2 (templates, historical docs, JSON/ZIP)

**Date:** 2026-08-17  
**Status:** accepted  
**Triggers:** migration | feature-module

## Context

Phase 1 added patient spreadsheet import/export on `/datos`. Phase 2 adds reusable mapping templates, historical document ingest (attachments only), and structured clinical JSON/ZIP export. FHIR R4 stays in phase 3.

## Decision

- Keep the surface on `/datos` (feature `integraciones`). No parallel Settings app.
- Templates live in `import_mapping_templates` (migration 118). Upload auto-applies a clinic template when required columns overlap headers; the wizard can still remap every field.
- Historical PDFs/images use `validateAdminDocumentUpload` + `patient_attachments`. They do **not** call PDF→SOAP extraction.
- Migration 119 adds `document_date`, `source`, `professional_id` on attachments. Inserts retry without those columns if Staging has not applied 119.
- JSON/ZIP export is a server action gated by `exportClinicalRecords` + `verifyPatientInClinic`. JSON omits internal UUIDs. ZIP is STORE (no new dependency), uploaded to `{clinicId}/export-staging/` and downloaded via a short-lived signed URL.
- FHIR folder is omitted; the ZIP manifest notes `fhir: "phase3"`.

## Consequences

- Apply migration 119 on Staging before relying on document date / source / professional on attachments.
- Attachment ZIP includes at most 50 files / 50 MB; the rest are listed as warnings.
- Phase 3 should add `services/interoperability/fhir/` rather than more UI on `/datos`.
