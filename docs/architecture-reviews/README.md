# Architecture decision records (ADR)

Lightweight notes required when a PR hits **architecture review triggers** (see [ARCHITECTURE_REVIEW.md](../ARCHITECTURE_REVIEW.md)).

## Naming

```
docs/architecture-reviews/NNN-short-kebab-name.md
```

Example: `012-consultation-journey-layers.md`

## Template

```markdown
# NNN — Title

**Date:** YYYY-MM-DD  
**Status:** accepted | superseded  
**Triggers:** migration | api-route | feature-module | …

## Context

What problem / feature drove this change?

## Decision

- Layer placement (UI / hook / action / server / util)
- Data flow
- Feature flags / migrations

## Consequences

- Test plan
- Rollback
- Known follow-ups
```

## Index

| ADR | Topic |
|-----|-------|
| 001 | Consultation journey + layer split (Phase I) — see commit `35f8fca` |
