# ReNaPDiS Phase 2 readiness (staging)

Status: **implemented on staging branch** — not production-deployed.  
Scope: patient identity / CUIL, CUIR architecture, structured prescription extensions, FHIR preparation, SNOMED abstraction, QR/document readiness, national e-Rx gate.

Phase 1 controls remain in force (professional identity, REFEPS status, MFA/AAL2, immutable audit, RLS, clinic isolation).

## Architecture

```text
Patient profile (existing form)
  └─ Identidad para receta electrónica (ReNaPDiS)
       CUIL / document type / sex / alternative ID

Local prescription issue
  Phase 1 MFA + clinical validation → national_rx_status=local

National electronic path (REFEPS submit / auto-submit)
  Phase 1 gate
    + patient identity (CUIL or permitted alternative)
    + prescription required fields
    + CUIR prerequisites
    + sandbox CUIR when official DNSISA IDs absent
    + FHIR preparation meta + terminology mapping attempt
```

| Area | Path |
|------|------|
| CUIR | `src/core/renapdis/cuir/` |
| Patient identity | `src/core/renapdis/patient-identity.ts` |
| Prescription categories | `src/core/renapdis/prescription-types.ts` |
| National ready gate | `src/core/renapdis/national-ready-gate.ts` |
| Prepare artifacts | `src/core/renapdis/prepare-national-rx.ts` |
| FHIR prep | `src/core/interoperability/fhir/` |
| SNOMED abstraction | `src/core/terminology/snomed/` |
| National submit wiring | `src/core/refeps/submission-service.ts` |
| Document / QR | `src/features/recetas/utils/prescription-document-coverage.ts`, `print-prescription-document.ts` |

## Migrations

Additive only:

- `supabase/migrations/141_renapdis_phase2_patient_cuir.sql`

On `develop`, 130–139 remain reserved for the compliance pack. Phase 1 = **140**, Phase 2 = **141**.

### Patients (additive)

- `cuil`, `sex` (F\|M\|X), `document_type` (default `dni`)
- `alt_identifier_type`, `alt_identifier_value`
- RPC `create_patient_with_clinical_profile` / `update_patient_with_clinical_profile` persist these fields

Local patient CRUD stays permissive when national identity fields are incomplete.

### Prescription drafts (additive)

- `validity_starts_at`
- `prescription_category` / `prescription_subtype`
- `national_rx_status`: `local` \| `sandbox` \| `national_ready` \| `submitted` \| `failed`
- CUIR component columns + `cuir_status` / `cuir_formatted`
- `diagnosis_coding` (jsonb), `fhir_bundle_meta` (jsonb)

## CUIR model

Six components:

1. Platform identifier (DNSISA-assigned)
2. Repository identifier (DNSISA-assigned)
3. Professional-license jurisdiction
4. Prescription type/subtype
5. Unique prescription group identifier
6. Item number

Components are stored separately on the prescription row and formatted with `|` separators for display/QR (avoids ambiguity when platform/repository codes contain hyphens).

**DrFlow does not currently have official DNSISA platform/repository identifiers.**  
Sandbox placeholders (`SBX-PLATFORM` / `SBX-REPO`) are for staging QA only and **must never be presented as legally valid**.

Official legal CUIR generation is blocked until DNSISA assigns real identifiers.

## Patient identity model

Primary national identifier: **CUIL** (structural checksum validation only — no AFIP/Ministry call).

If no CUIL: permitted alternative (`cuit` \| `cdi` \| `passport` \| `other`) + value.

National e-Rx also requires name, document, birth date, sex.

Local management is not blocked by incomplete national identity.

## FHIR preparation

Internal serializers only (`Patient`, `Practitioner`, `MedicationRequest`, `ServiceRequest`, `Coverage`, `Bundle`).

- Not claimed as official DNSISA FHIR conformance.
- No invented Argentine DNSISA FHIR profile.
- Bundles tagged `urn:drflow:interoperability` / `preparation`.
- Sandbox CUIR → `legalValidity: sandbox_only`.

## SNOMED strategy

`unmappedTerminologyAdapter` preserves free text, sets `status: unmapped`, never fabricates codes.

Adapter interface ready for a licensed/official terminology service later.

## National e-Rx gate

Before `national_ready` / sandbox readiness:

- authenticated user, clinic membership, prescription permission
- MFA AAL2 (Phase 1)
- professional REFEPS validation + license/jurisdiction (Phase 1)
- patient identity + CUIL/alternative
- diagnosis, items, issue date
- CUIR prerequisites; official platform/repository IDs required only in `official` mode

Local prescriptions remain functional without national prerequisites.

## Tests

- `tests/renapdis-phase1.test.ts` (unchanged Phase 1)
- `tests/renapdis-phase2.test.ts` (identity, CUIR, types, gate, FHIR, SNOMED, audit tags)
- Migration consistency expects **141** as latest on this branch

## Remaining external dependencies / blockers for homologation

1. **Official DNSISA platform identifier** — not assigned.
2. **Official DNSISA repository identifier** — not assigned.
3. Official REFEPS / ReNaPDiS Ministry API credentials and endpoints (not invented here).
4. Official FHIR Implementation Guide validation / Argentine profile (if/when published).
5. Licensed SNOMED CT terminology service configuration.
6. Production MFA enrollment and professional validation rollout.
7. Legal/compliance review of sandbox vs official labeling on printed documents.

**Until DNSISA assigns platform and repository identifiers, DrFlow cannot produce an official legal CUIR.**

## Manual QA (staging)

1. Open a patient → confirm **Identidad para receta electrónica** fields save (CUIL / sex / alt ID).
2. Issue a **local** prescription without CUIL → succeeds.
3. Attempt REFEPS national submit without patient CUIL/alt → blocked + audit `national_prescription_blocked`.
4. With valid patient identity + sandbox REFEPS professional → prepare path stores sandbox CUIR; print/preview shows **CUIR SANDBOX (sin validez legal)** and QR hint without Ministry validation claim.
5. Confirm Phase 1 MFA still required for issue/submit.
6. Confirm another clinic cannot see the patient/prescription (RLS).
