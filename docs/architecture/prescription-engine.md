# Prescription Engine — Architecture Decision Record

**Status:** Accepted (Etapa 0–1)  
**Date:** 2026-08-10

## Context

DrFlow needs a single configurable prescription engine for all coverages (PAMI, obras sociales, prepagas, particular) without duplicating modules per insurer.

Current state:
- `prescription_drafts` stores medication Rx with JSONB `medications`
- Drug search is coupled to PAMI vademécum for all patients
- States: `draft | issued | void` (UI alias: cancelled)
- No idempotency, templates, or coverage strategies on Rx (medical orders already have idempotency)

## Decision

Introduce a **PrescriptionEngine** domain layer with **CoverageStrategy** plugins. Extend `prescription_drafts` evolutively; add `prescription_events`, `prescription_templates`, and `coverage_rules` tables.

Do **not** merge `prescription_drafts` with `medical_orders` (studies, referrals, PAMI planillas remain separate).

## Architecture

```
UI → Actions → prescriptions.service → PrescriptionEngine → CoverageStrategy → Repository → Supabase
```

### Coverage strategies

| Kind | Detection | Notes |
|------|-----------|-------|
| `PAMI` | `isPamiCoverage()` | Vademécum search; beneficio required (configurable) |
| `PREPAGAS` | Known prepaga list | Afiliado + plan |
| `OBRAS_SOCIALES` | Default non-PAMI OS | Afiliado |
| `PARTICULAR` | "Particular" or empty | Minimal requirements |

PAMI normative rules are **not hardcoded**. Defaults live in `DEFAULT_COVERAGE_RULES`; clinics override via `coverage_rules.rules` JSONB.

### States

| UX label | Storage |
|----------|---------|
| DRAFT | `status = 'draft'` |
| ISSUED | `status = 'issued'` |
| CANCELLED | `status = 'void'` |
| DISPENSED | `status = 'issued'` AND `dispensed_at IS NOT NULL` |

### Security

- All mutations via server actions with `requireClinicalIssueAccess()`
- FK ownership checks before write
- Zod at boundary; engine validates coverage rules before issue
- Idempotency key unique per `(clinic_id, idempotency_key)` on issue
- `prescription_events` for traceability

## Consequences

- **Positive:** Add new coverage without touching core engine; reuse print/PDF layer
- **Negative:** Temporary duplication with medical-order patterns until shared clinical-document abstraction
- **Migration:** `096_prescription_engine.sql` — additive only

## Out of scope (Etapa 1)

- Wizard UI (Etapa 2)
- REFEPS integration
- Normalized `prescription_items` table
- Pharmacy dispensation workflow UI
