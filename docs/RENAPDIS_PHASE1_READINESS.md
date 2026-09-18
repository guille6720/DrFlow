# ReNaPDiS Phase 1 readiness (staging)

Status: **implemented on staging branch** — not production-deployed.  
Scope: identity + REFEPS professional validation scaffolding + MFA for prescritors + national e-Rx gates.

## Architecture implemented

```text
Médicos → Equipo → Perfil  (/ingreso-profesionales?id=<professionalId>)
        │
        ├─ section: "Validación profesional — ReNaPDiS"
        ├─ identity fields + Validar REFEPS (server action)
        └─ MFA status / enroll / elevate (session AAL)

Prescription issue (local)
  requireClinicalIssueAccess → MFA AAL2 → existing engine validation → issue

National electronic (REFEPS submit / auto-submit)
  same as local + evaluateNationalPrescriptionEligibility(status ∈ {sandbox, validated})
```

Key modules:

| Area | Path |
|------|------|
| Types / statuses | `src/core/renapdis/types.ts` |
| Adapters | `src/core/renapdis/adapters.ts` |
| `validatePrescriber()` | `src/core/renapdis/validate-prescriber.ts` |
| Issue gate (pure) | `src/core/renapdis/prescription-issue-gate.ts` |
| MFA | `src/core/auth/prescriber-mfa.server.ts` |
| UI (ingreso profesionales) | `src/features/profesionales/.../professional-renapdis-section.tsx` |
| Actions | `src/lib/actions/professional-verification.ts` |
| National submit gate | `src/core/refeps/submission-service.ts` |
| Local issue MFA | `src/features/recetas/actions/prescriptions.ts` |

### Validation statuses (explicit)

| Status | Meaning | National e-Rx |
|--------|---------|---------------|
| `sandbox` | Staging sandbox adapter accepted local identity | Allowed (staging only; **not** legal homologation) |
| `validated` | Reserved for future official Ministry adapter success | Allowed |
| `pending` | Validation in progress | Blocked |
| `failed` | Last validation failed | Blocked |
| `not_configured` | Never validated / identity changed | Blocked |

**Never trust client-side validation.** UI only displays persisted server state.

## DB changes

Additive migration only:

- `supabase/migrations/140_renapdis_phase1_professionals.sql`

> On `develop`, numbers 130–139 are reserved for the compliance pack not yet merged. Phase 1 ships as **140**. Staging DB already has the columns (identical `ADD COLUMN IF NOT EXISTS` SQL applied earlier). Do not re-apply blindly.

New `professionals` columns:

- `cuil`
- `refeps_identifier`
- `licensing_jurisdiction`
- `issuing_authority`
- `refeps_specialty`
- `refeps_validation_status` (check constraint; default `not_configured`)
- `refeps_validated_at`
- `refeps_validation_error`
- `refeps_validation_details` (jsonb)

Existing columns kept: `license_number`, `license_national`, `license_provincial`, `tax_id`, `specialty_id`, RLS, clinic isolation.

No rewrites of migrations 001–139. No clinical RLS changes. No `clinic_members` / plans / Mercado Pago changes.

## Security controls

1. **Auth + clinic membership + `issuePrescriptions`** — unchanged `requireClinicalIssueAccess`.
2. **MFA (Supabase Auth TOTP)** — required elevated session (`aal2`) before:
   - issuing a prescription
   - submitting to REFEPS
3. MFA **not** forced for roles that never prescribe.
4. **National e-Rx** additionally requires professional REFEPS status `sandbox` or `validated`, plus CUIL + license.
5. Cross-clinic: professional loads always `.eq("clinic_id", clinicId)`.
6. Immutable audit (`audit_logs`) events:
   - `professional_validation_attempt`
   - `professional_validation_success` / `professional_validation_failure`
   - `mfa_enrollment`
   - `prescription_blocked` (identity / MFA / REFEPS)

## Tests

`tests/renapdis-phase1.test.ts` covers:

- missing CUIL / license
- REFEPS failure / not_configured / pending
- MFA missing
- authorized local flow
- authorized national + sandbox
- sandbox adapter behavior
- official adapter stays `not_configured` (no invented Ministry API)
- auth / membership / permission denials

Also rely on existing:

- `tests/refeps-integration.test.ts` (sandbox prescription adapter)
- `tests/rls-policies.test.ts` (professionals still in RLS set)
- prescription engine / ownership tests

## Remaining external dependencies

Official ReNaPDiS / REFEPS / Ministry assets **not** available to DrFlow yet:

- Official professional lookup endpoint URL
- Auth credentials / mTLS / certificates
- Request/response schemas
- CUIR / identifier algorithms
- Homologation environment access
- Legal signing / timestamping requirements beyond current local hash

The official adapter is intentionally a **stub** (`not_configured`) so Ministry specs can be plugged in without redesigning the prescription module.

## What still prevents official ReNaPDiS homologation

1. No official REFEPS professional validation API wired (by design — specs not invented).
2. Sandbox status ≠ legal national validity.
3. Clinic-level REFEPS establishment credentials / MSN homologation process still external.
4. MFA must be enabled in the **Supabase project Auth settings** (TOTP) for staging.
5. Migration `140` must be applied on staging DB before UI fields persist.
6. Production must not receive this pack until staging sign-off.

## Staging apply (DB)

```bash
# From repo root, linked to staging project only:
npx supabase db push --linked
# or apply 140 alone via approved staging migration workflow
```

Do **not** apply to production (`nipqdarduknydqptqzup`) as part of this Phase 1 readiness task.

## Manual staging test plan

1. Confirm migration `140` / Phase 1 columns exist on staging DB (already applied; do not re-run blindly).
2. Login as clinic admin → **Médicos / Ingreso de profesionales** → select a professional → tab **Perfil**.
3. Scroll to **Validación profesional — ReNaPDiS**; fill CUIL, license, jurisdiction, authority, specialty; save.
4. Click **Validar REFEPS** → status becomes `sandbox`; audit row appears.
5. As a doctor with `issuePrescriptions`: enroll MFA TOTP; confirm code → AAL2.
6. Issue a **local** prescription with elevated MFA → succeeds (legal_validity remains local draft).
7. Without MFA / after session drops to AAL1 → issue blocked with clear error + audit `prescription_blocked`.
8. Enable clinic REFEPS; try national submit with professional `not_configured` → blocked.
9. After sandbox validation → national submit uses existing sandbox prescription adapter (`REFEPS-SBX-*`).
10. Login as secretary (no prescribe permission) → MFA prescritor section not mandatory; cannot issue.
11. Confirm another clinic’s professional id cannot be validated under the active clinic (cross-clinic isolation).
