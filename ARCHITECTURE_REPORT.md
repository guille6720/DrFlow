# Architecture Report — Enterprise Stabilization

**Date:** 2026-07-30  
**Program:** DrFlow Enterprise Stabilization  
**ADR:** [003-stabilization-program.md](docs/architecture-reviews/003-stabilization-program.md)

---

## 1. Audit summary

| Metric | Before program | After program |
|--------|----------------|---------------|
| Components >200 lines | 8 | 8 (baseline locked) |
| Components >350 lines | 0 | 0 |
| Hooks >150 lines | 8 | 8 (baseline locked) |
| Hooks in `components/` | 1 | **0** |
| Largest component | 217 (`command-palette-provider`) | **66** (refactored) |
| Supabase mutations in UI | 0 violations | 0 |

## 2. Layer compliance

**Enforced by `architecture-gate.mjs`:**
- No server Supabase in client components
- No admin client in UI
- No `.rpc()` in UI (except `*-client.tsx`)
- No insert/update/delete from UI components

**Pattern:**
```
Component → Hook → Action/Loader → Supabase
```

## 3. Refactors implemented

### Command palette (Risk 1)
| File | Before | After | Change |
|------|--------|-------|--------|
| `command-palette-provider.tsx` | 217 | 66 | Presentation + context only |
| `use-command-palette-state.ts` | — | 99 | Orchestration |
| `use-command-palette-keyboard.ts` | — | 88 | Keyboard handling |
| `use-command-palette-patient-search.ts` | — | 44 | Patient API fetch |

### Dashboard ops tasks
- Moved `use-completed-tasks.ts` → `lib/hooks/use-completed-ops-tasks.ts`

## 4. Baseline grandfathered debt (paydown queue)

**Components (8):** `app-install-card`, `patient-indicators-calculator`, `drug-treatment-list`, `prescription-form`, `patient-chart-grid-secondary`, `nueva-consulta-form-body`, `command-palette-dialog`, `edit-appointment-dialog`

**Hooks (8):** `use-nueva-consulta-form`, `use-professional-intake`, `use-register-clinic-form`, `use-patient-consult-sheet`, `use-restablecer-password`, `use-edit-consulta-form`, `use-pharmacology-search`, `use-agenda-view`

**Rule:** Line count must not increase; remove from baseline when split below target.

## 5. New infrastructure

| File | Purpose |
|------|---------|
| `scripts/stabilization-gate.mjs` | Regression lock |
| `scripts/stabilization-baseline.json` | Grandfathered debt registry |
| `scripts/stabilization-audit.mjs` | Metrics for reports |
| `src/lib/utils/stabilization-limits.ts` | Canonical limits + tests |

## 6. UX architecture decisions (recent, preserved)

- **Clinical Operations Center** (`/dashboard`) — 3-column ops layout
- **Clinical Workspace** (`/pacientes/[id]?tab=resumen`) — 10-second summary screen
- **Consultation Journey** — linear in-patient flow with embedded AI (physician confirm)

## 7. Recommendations

1. Split `use-nueva-consulta-form.ts` (231 lines) — highest hook debt
2. Retire `patient-chart-grid-secondary.tsx` usage as clinical workspace matures
3. Add function-length lint rule (40 lines) via custom ESLint when feasible
4. Monthly baseline paydown sprint — target 1 component + 1 hook per release

---

*Validated: `npm run architecture:gate` ✅ · `npm run stabilization:gate` ✅*
