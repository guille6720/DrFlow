# 006 — FHIR R4 interoperability (import / export phase 3)

**Date:** 2026-08-17  
**Status:** accepted  
**Triggers:** feature-module

## Context

Phase 2 shipped JSON/ZIP clinical export without FHIR. The product spec requires an HL7 FHIR R4 layer for import, export, and advanced clinical migration, without spreading mapping logic through UI.

## Decision

- Mapping lives in `src/core/services/interoperability/fhir/` (DrFlow equivalent of `/services/interoperability/fhir/`).
- Export reuses `loadPatientExportPackage` and maps the snapshot to a Bundle (`Patient`, `Practitioner`, `Encounter`, `Condition`, `Observation`, `AllergyIntolerance`, `MedicationRequest`, `DiagnosticReport`, `DocumentReference`). Local keys, DNI as identifier — no internal UUIDs.
- ZIP includes `FHIR/bundle.json` plus split collection files. Manifest `fhir: "r4"`.
- Import parses a Bundle/Patient JSON, stores it in `data_import_sessions` (`import_type = fhir`), then writes only after confirm. Duplicate policy matches phase 1 (DNI exact / name+DOB). Encounters append with `[FHIR:dni:localKey]` idempotency; SOAP/diagnoses of existing records are never overwritten. Profile allergies/history fill empty fields only. No `prescription_drafts` (unsigned legal artifacts). Attachment binaries are omitted with a warning.
- UI stays on `/datos` (`import-fhir` + FHIR format on export HC / EHR menu).

## Consequences

- Caps: 2 MB JSON, 50 patients, 200 encounters, 500 resources.
- Round-trip is lossy for unsigned recetas, vitals-as-numbers, and file bytes.
- No new FHIR client library; R4 subset is mapped in-process.
