# Prescription Engine — Architecture Decision Record

**Status:** Accepted (Etapas 0–6 complete)  
**Date:** 2026-08-10  
**Last hardening:** 2026-08-11 (Etapa 6)

## Context

DrFlow needs a single configurable prescription engine for all coverages (PAMI, obras sociales, prepagas, particular) without duplicating modules per insurer.

## Decision

Introduce a **PrescriptionEngine** domain layer with **CoverageStrategy** plugins. Extend `prescription_drafts` evolutively; add `prescription_events`, `prescription_templates`, and `coverage_rules` tables.

Do **not** merge `prescription_drafts` with `medical_orders` (studies, referrals, PAMI planillas remain separate).

## Architecture

```
UI → Actions → prescriptions.service → PrescriptionEngine → CoverageStrategy → Repository → Supabase
```

### Implemented stages

| Etapa | Scope |
|-------|-------|
| 0–1 | Engine, migration 096, strategies, idempotency |
| 2 | Wizard UI 3 pasos |
| 3 | Plantillas CRUD, reuse flow, historial |
| 4 | PDF cobertura, QR local, WhatsApp confirm |
| 5 | Panel config PAMI (`coverage_rules`) |
| 6 | QA matrix, security hardening, performance review |

### Security hardening (Etapa 6)

- **Issue-time coverage:** `resolveAuthoritativeCoverageForIssue()` uses patient DB `insurance_provider` — client cannot downgrade PAMI → PARTICULAR on emit.
- **Disclaimer:** `disclaimer_accepted` persisted from form; required on issue.
- **coverage_rules RLS:** Writes restricted to `can_manage_clinic` (migration 097).
- **QR:** Generated in-app (`react-qr-code` / `qrcode-generator`) — no PHI to third parties.
- **IDOR:** `verifyPrescriptionForeignKeys` on save; RLS clinic-scoped.
- **Idempotency:** Unique `(clinic_id, idempotency_key)` on issue.

### Performance (Etapa 6)

Migration 096 indexes cover hot paths:

- `(clinic_id, idempotency_key)` partial unique — issue dedup
- `(clinic_id, coverage_kind)` — analytics/filters
- Patient workspace loads `coverage_rules` once per recetas tab (small table, no GIN needed)

Vademécum search retains existing GIN/trigram indexes (migration 088). No additional Rx-specific GIN required.

### QA matrix

Automated: `tests/prescription-engine-qa-matrix.test.ts`, `prescription-engine.test.ts`, `prescription-idempotency.test.ts`, `prescription-coverage-rules.test.ts`, `prescription-document.test.ts`.

Manual checklist: `src/core/qa/checklist-data.ts` → section **Recetas y órdenes**.

Module export: `docs/qa-modules/recetas.json`.

## Out of scope

- REFEPS integration
- Normalized `prescription_items` table
- Pharmacy dispensation workflow UI
- Merging with `medical_orders`

## Consequences

- **Positive:** Add new coverage without touching core engine; reuse print/PDF layer
- **Negative:** Temporary duplication with medical-order patterns until shared clinical-document abstraction
- **Migration:** `096_prescription_engine.sql`, `097_coverage_rules_manage_settings_rls.sql`
