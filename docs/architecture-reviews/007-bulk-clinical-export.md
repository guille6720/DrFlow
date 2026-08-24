# 007 — Bulk clinical export (import / export phase 4)

**Date:** 2026-08-17  
**Status:** accepted  
**Triggers:** migration | feature-module

## Context

Phases 1–3 shipped patient spreadsheet import/export, JSON/ZIP/FHIR for a single history, and FHIR import. The original spec still required an administrator-only bulk export with filters, selectable clinical sections, multiple formats, a sensitivity confirmation, and server-side processing so the browser does not hold thousands of records.

## Decision

- Surface stays on `/datos?flujo=export-masivo` (permission `bulkExportData`, admin/superadmin).
- Filters: all vs selected patients, date range, professional (patients with encounters from that professional), insurance provider, reusable clinical sections.
- Formats: CSV, XLSX, JSON, FHIR R4 collection, ZIP (`Patients/{name}/` using the phase 2 packer). CSV with several sheets becomes a ZIP of CSVs.
- Work runs as `clinic_jobs.job_type = export_clinical_bulk` (migration 120). Staging stays in private `clinical-files` `{clinicId}/export-staging/`. Polling issues a short-lived signed URL; the job result stores the path, not file bytes.
- Caps: 5000 (CSV/XLSX demographics), 500 (spreadsheet with clinical rows), 200 JSON, 100 FHIR, 25 ZIP. Selected patients max 200.

## Consequences

- Apply migration 120 on Staging before enqueueing the new job type (CHECK on `clinic_jobs.job_type`).
- Professional filter selects patients, not “only that professional’s SOAP rows”.
- Round-trip remains lossy for the same reasons as phase 3 (unsigned recetas, attachment bytes in non-ZIP formats).
- Rollback: revert 120 only after draining pending `export_clinical_bulk` jobs.
