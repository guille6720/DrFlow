# ADR 003 — Enterprise Stabilization Program

**Status:** Accepted  
**Date:** 2026-07-30  
**Authors:** DrFlow Engineering  

## Context

QA audit identified recurring risks: oversized components/hooks, architecture regression, and insufficient guardrails against new debt.

## Decision

1. Introduce **`stabilization-gate.mjs`** with baseline lock (`scripts/stabilization-baseline.json`):
   - New components must be ≤200 lines
   - New hooks must be ≤150 lines
   - Baseline grandfathered files must not grow in line count
   - Hooks forbidden under `src/components/`

2. Tighten **architecture-gate** warnings to stabilization targets (200/150) while keeping hard limits (350/280).

3. Refactor **command palette** into presentation + hooks (`use-command-palette-state`, keyboard, patient search).

4. Move **`use-completed-ops-tasks`** to `src/lib/hooks/`.

5. Add **`stabilization-limits.ts`** as canonical limits for tests and documentation.

6. Wire stabilization gate into **CI** and **`quality-gate.mjs`**.

## Consequences

- CI fails on new architectural debt; existing debt tracked in baseline.
- Incremental paydown required — baseline entries removed as files are split.
- Reports generated under stabilization audit for executive visibility.

## Alternatives considered

- Hard fail all files >200 immediately — rejected (breaking CI, high churn).
- Warnings only — rejected (no regression prevention).
