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

Six modules (Resolución 2214/2025, Anexo IV):

| Module | Meaning | Official rule |
|--------|---------|---------------|
| M1 | Platform identifier | numeric, exactly 4 digits, DNSISA-assigned |
| M2 | Repository identifier | numeric, exactly 4 digits, DNSISA-assigned |
| M3 | Jurisdiction | numeric, exactly 2 digits (INDEC code) |
| M4 | Prescription type/subtype | numeric, exactly 4 digits (regulatory mapping) |
| M5 | Unique prescription group id | numeric, max 25 digits |
| M6 | Item number | numeric, exactly 2 digits (`1` → `01`) |

**Official CUIR** = direct concatenation of the six modules with **no separators**.

Example shape (regulation): `10250042020101000012345678901234567890101`

Components remain stored separately in DB (`cuir_platform_id`, …). `cuir_formatted` holds:

- **official:** concatenated numeric CUIR after `validateOfficialCuirComponents()` succeeds
- **sandbox:** internal debug string from `formatSandboxCuirDebug()` (`|`-delimited) — **never** the official format and **never** legally valid

UI may show human jurisdiction labels (e.g. “CABA”); official serialization uses the INDEC code (`02`).

**M4 mapping:** registry is intentionally empty until mappings from the published regulation are confidently implemented. Unmapped types keep the prescription pending / not officially ready.

**DrFlow does not currently have official DNSISA platform/repository identifiers.**  
Official mode cannot unlock without real 4-digit M1/M2. Sandbox placeholders (`SBX-PLATFORM` / `SBX-REPO`) are staging QA only.

Official document/QR shows a CUIR **only** after strict official validation. Sandbox shows **CUIR SANDBOX — SIN VALIDEZ LEGAL**.

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
- `tests/renapdis-phase2.test.ts` (identity, official CUIR Anexo IV, sandbox debug, types, gate, FHIR, SNOMED, audit tags)
- Migration consistency expects **141** as latest on this branch

### Full-suite BASE vs HEAD (Phase 2 merge)

Compared develop **before** Phase 2 (`320bfe9c`) vs Phase 2 merge (`423da232`) with the same `npx vitest run`:

| | Failed tests |
|--|--|
| BASE `320bfe9c` | **8** |
| HEAD `423da232` | **8** (same set) |

Phase 2 did **not** introduce full-suite regressions. The earlier “9 failures” report was incorrect relative to this BASE comparison (same eight unrelated failures remain on both commits).

## Remaining external dependencies / blockers (non-exhaustive)

This list is **not** an exhaustive homologation checklist and does **not** claim ReNaPDiS approval.

Known external blockers for official legal CUIR / national submission include (among others):

1. **Official DNSISA platform identifier (M1)** — not assigned.
2. **Official DNSISA repository identifier (M2)** — not assigned.
3. Complete official **M4 type/subtype** mapping from the published regulation (not invented here).
4. Official REFEPS / ReNaPDiS Ministry API credentials and endpoints (not invented here).
5. Official FHIR Implementation Guide validation / Argentine profile (if/when published).
6. Licensed SNOMED CT terminology service configuration.
7. Production MFA enrollment and professional validation rollout.
8. Legal/compliance review of sandbox vs official labeling on printed documents.
9. Any additional DNSISA/MSAL technical annexes, certificates, or operational requirements not yet wired in DrFlow.

**Until DNSISA assigns platform and repository identifiers (and M4 mappings are implemented from the regulation), DrFlow cannot produce an official legal CUIR.**

## Manual QA (staging)

1. Open a patient → confirm **Identidad para receta electrónica** fields save (CUIL / sex / alt ID).
2. Issue a **local** prescription without CUIL → succeeds.
3. Attempt REFEPS national submit without patient CUIL/alt → blocked + audit `national_prescription_blocked`.
4. With valid patient identity + sandbox REFEPS professional → prepare path stores sandbox debug CUIR; print/preview shows **CUIR SANDBOX — SIN VALIDEZ LEGAL** and QR hint without Ministry validation claim. Official numeric CUIR must not appear.
5. Confirm Phase 1 MFA still required for issue/submit.
6. Confirm another clinic cannot see the patient/prescription (RLS).
