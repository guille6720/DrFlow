# 010 — Production branch divergence and baseline repair

**Date:** 2026-10-14  
**Status:** proposed — inherited triggers require human reviewer sign-off (see §4)  
**Triggers:** migration (10) · feature-module (23 inherited + 2 repair) · api-route (2) · dashboard-route (1)  
**Branch:** `repair/nexclinic-baseline-20261014` (from production build `08fcc006`)

## 1. Context

`architecture-review --strict --base origin/main` diffs `origin/main...HEAD` from the merge-base.
Production (`codex/nexclinic-production-ui`, `08fcc006`) diverged from `main` at `83511eb1`
(2026-09-17, PR #17 release/0.2.19). Since then production received **31 commits** that never went
through a PR to `main`, while `main` received 1. The repair branch adds Phase 0B/0C commits on top.

Measured on 2026-10-14:

| Diff | Triggers |
|------|----------|
| `origin/main...HEAD` (before Phase 0C refactor) | 36 — all inherited from production |
| `08fcc006...HEAD` (repair commits only, Phase 0A/0B) | 0 |
| Phase 0C refactor (committed with this ADR) | 2 `feature-module` |

This ADR documents both sets so the gate reflects real review state instead of being bypassed.
It does **not** re-baseline, allowlist or disable the gate.

## 2. Inherited from production (31 commits, 2026-09-17 → 2026-10-02)

### 2.1 Migrations (10)

| Migration | Tables | RLS / policies | Notes |
|-----------|--------|----------------|-------|
| `20260928120000_feature_customizations` | `feature_definitions`, `clinic_feature_settings`, `user_feature_settings` | 3 / 3 | 6 SECURITY DEFINER RPCs; in RLS manifest |
| `20260928155026_hardening_clinic_products_grants` | — | — | Grants: SELECT-only for `authenticated` |
| `20260928203000_clinic_role_permissions` | `clinic_role_permissions` | 1 / 1 | In RLS manifest |
| `20260928220000_clinic_role_permissions_geriatrics` | — | — | Adds geriatrics permissions |
| `20260929100000_medical_orders_v2` | `medical_order_counters`, `medical_order_items`, `medical_order_catalog` | 3 / 8 | **Not in RLS manifest** (finding F1) |
| `20260929110000_medical_order_catalog_panels` | — | — | Catalog data |
| `20260929120000_national_eprescription_repository` | — | — | Provider-agnostic e-prescription |
| `20260929121000_national_rx_guard_inline_writer_check` | — | — | Guard function |
| `20260929130000_rcta_integration_feature` | — | — | Feature definition (RCTA link-out) |
| `20260930120000_pami_integration_feature` | — | — | Feature definition (PAMI link-out) |

Replay order: all 10 are timestamped and run after `160_*` on a fresh database (see
`npm run check:migrations`). Whether each is applied in production/staging was **not** verified
here (no remote DB access in this phase).

### 2.2 API routes (2)

`GET /api/rcta/launch-context`, `GET /api/pami/launch-context` — read-only, `no-store`, wrapped in
`withObservabilityApiRoute`. The loaders require an authenticated user + clinic (401 otherwise),
scope queries by `clinic_id`, and are gated by clinic feature settings. GET-only, so the CSRF
same-origin audit does not apply.

### 2.3 Dashboard route (1) and feature modules (23)

- `/ordenes-medicas` page + `src/features/ordenes-medicas/**` (13 files): medical orders v2
  (actions, server loader, validation, PDF export, UI). `medical-order-form` (566 lines),
  `medical-orders-browser` (406), `medical-order-detail` (349) exceed component budgets.
- `src/features/pacientes/components/pacientes/clinical-integrations/**`, `rcta-launch-card.tsx`:
  external RCTA / PAMI launch UI (link-out only, no clinical data sent).
- `src/features/recetas/**` (3 files): national prescription panel, RCTA entry routing hook.
- `role-permissions-matrix.tsx`: per-clinic role permissions UI.

### 2.4 Findings

- **F1 — RLS manifest gap.** `medical_order_items` and `medical_order_catalog` have RLS + policies;
  `medical_order_counters` has RLS, no policies and `REVOKE ALL` from `anon`/`authenticated`
  (written only by a SECURITY DEFINER numbering function — deny-all by design). None of the three
  is in `TABLES_REQUIRING_RLS`, so the static audit does not guard them against regressions.
  Recommended: add all three (counters under `RLS_DENY_ALL_TABLES`).
- **F2 — No PR review trail.** These 31 commits reached production without a PR to `main`, so the
  checklist in `ARCHITECTURE_REVIEW.md` §4 was never completed for them.
- **F3 — Component budgets.** Medical orders UI adds 3 architecture/stabilization violations.

## 3. Introduced by the repair branch

| Change | Layer placement |
|--------|-----------------|
| `src/core/security/rls-static-audit.ts` (0B) | Pure parser used by tests; no runtime import |
| `scripts/lib/migration-versions.mjs` (0B) | Repo check; reads filenames only |
| Lifecycle filter in `batch-patient-record-counts.ts` (0B) | Server util; read-only query change |
| `src/lib/utils/command-palette-static-items.ts` (0C) | Pure business logic extracted from `use-command-palette-state` |
| `agenda/horizon-month-select.tsx` (0C, **feature-module**) | Presentation; replaces duplicated month `<select>` in `month-overview-grid` and `appointment-datetime-picker` |
| `configuracion/voice-dictation-preference-card.tsx` (0C, **feature-module**) | Presentation; voice preference card moved out of `appearance-style-panel`, behavior unchanged |

No migrations, API routes, dashboard routes, orchestrators or feature flags were added by the repair.

## 4. Review status

| Item | Status |
|------|--------|
| Repair-branch changes (§3) | Author-reviewed; unit/component tests added; tsc + ESLint clean |
| Inherited migrations (§2.1) | **Pending** DB owner review (Migration / RLS escalation) |
| Inherited RCTA/PAMI/e-prescription (§2.2–2.3) | **Pending** engineer + clinical product owner review |
| F1 manifest gap | **Open** — not changed in this phase |

This note satisfies the mechanical requirement of `architecture-review --strict` (an ADR file in the
diff). It does not certify the inherited changes; reviewers should complete §4 before merging the
repair branch into `main`.

## 5. Consequences

- Tests: see Phase 0B/0C reports; `npm test`, `test:rls:static`, `check:migrations`.
- Rollback: repair commits are isolated and revertible; no data or schema changes.
- Follow-ups: close F1; reconcile `main` with production via a reviewed PR; continue incremental
  splitting of components over budget (non-clinical first).
