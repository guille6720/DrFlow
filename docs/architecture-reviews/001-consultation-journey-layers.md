# 001 — Consultation journey and layer split

**Date:** 2026-08-04  
**Status:** accepted  
**Triggers:** large-component, dashboard-route (patient workspace flow)

## Context

Phase I introduced a linear consultation flow (evolution → Rx → order → follow-up → close) inside the patient shell. `PatientConsultSheet` exceeded 250 lines and mixed presentation, orchestration, and data access.

## Decision

| Concern | Location |
|---------|----------|
| Overlay shell | `patient-consult-sheet.tsx` |
| Step presentation | `consultation-journey-step-content.tsx` |
| Orchestration | `use-patient-consult-sheet.ts` |
| Journey state machine | `use-consultation-journey.ts` + `consultation-journey.ts` |
| Follow-up scheduling | `consultation-follow-up.ts` + `use-consultation-follow-up.ts` |
| Mutations | `lib/actions/appointments.ts`, `clinical-records.ts` |
| Validation (server) | `appointmentSchema` in `lib/validations/schemas` |

No Supabase calls in components. Physician confirmation required for all clinical outputs (unchanged).

## Consequences

- Architecture gate: 0 components ≥ 250 lines
- Tests: `consultation-journey.test.ts`, `consultation-follow-up.test.ts`
- Follow-up: extract `use-medical-order-form`, split `load-patient-workspace-page` by domain
