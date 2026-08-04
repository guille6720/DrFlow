# Engineering Standards — DrFlow Enterprise Stabilization v2.0

**Canonical detail:** [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md)  
**Definition of Done:** [docs/DEFINITION_OF_DONE.md](docs/DEFINITION_OF_DONE.md)  
**Architecture review:** [docs/ARCHITECTURE_REVIEW.md](docs/ARCHITECTURE_REVIEW.md)

---

## Layer model (mandatory)

```
Presentation (components/)     → JSX, layout, a11y only
Hooks (lib/hooks/)             → Client orchestration
Actions (lib/actions/)         → Server mutations + auth
Loaders (lib/server/)          → SSR data fetch
Utils (lib/utils/)             → Pure logic, 90%+ coverage
Supabase                       → RLS-enforced data
```

## Size limits (CI enforced)

| Artifact | Stabilization target | Hard fail | Gate |
|----------|---------------------|-----------|------|
| Component | ≤200 lines | >350 lines | `stabilization-gate` + `architecture-gate` |
| Hook | ≤150 lines | >280 lines | `stabilization-gate` + `architecture-gate` |
| Function | ≤40 lines | — | Code review |

**Baseline debt:** `scripts/stabilization-baseline.json` — grandfathered files must **not grow**.

## Rejected in PR / CI

- `TODO` / `FIXME` comments
- `eslint-disable`, `@ts-ignore`, `@ts-nocheck`
- Unsafe `any`
- `console.log` in production paths
- Supabase mutations in UI components
- Hooks under `src/components/`
- New components >200 or hooks >150 lines
- Architecture triggers without ADR (`docs/architecture-reviews/`)

## Quality commands

```bash
npm run quality:gate          # Full enterprise gate
npm run stabilization:gate    # Baseline regression lock
npm run architecture:review:strict  # ADR check (PR)
```

## ADRs

| ADR | Topic |
|-----|-------|
| [001](docs/architecture-reviews/001-consultation-journey-layers.md) | Consultation journey layers |
| [002](docs/architecture-reviews/002-embedded-ai-journey.md) | Embedded AI in journey |
| [003](docs/architecture-reviews/003-stabilization-program.md) | Stabilization program |

---

*Stabilization program implemented 2026-07-30 — commit includes gates, baseline, command palette refactor.*
