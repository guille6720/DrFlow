# Architecture Review — DrFlow

**Version:** 1.0  
**When:** Any PR that adds or materially changes product behavior  
**Companion:** [ENGINEERING_STANDARDS.md](./ENGINEERING_STANDARDS.md) · [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md)

---

## 1. Why

DrFlow is past the size where new features can land without explicit layer decisions. Automated gates catch anti-patterns; **this process catches design drift** before it becomes debt.

---

## 2. Automated vs human review

| Control | Tool | Blocks merge |
|---------|------|--------------|
| Type safety | `npm run typecheck` | ✅ CI |
| Lint / code smell | `npm run lint`, `code-quality-gate` | ✅ CI |
| Security | `security-gate`, RLS static tests | ✅ CI |
| Component size, UI/data separation | `architecture-gate` | ✅ CI |
| **Significant change triggers** | `architecture-review --strict` | ✅ CI (PRs) |
| Layer design, clinical safety, UX | Human reviewer + ADR note | ✅ Required when triggered |

---

## 3. Mandatory review triggers

CI runs `node scripts/architecture-review.mjs --strict` on pull requests. If any trigger fires, the PR **must** include an ADR note under `docs/architecture-reviews/`.

| Trigger | Example |
|---------|---------|
| **migration** | `supabase/migrations/057_*.sql` |
| **api-route** | New `src/app/api/**/route.ts` |
| **feature-module** | New files under `src/features/<name>/` |
| **dashboard-route** | New `src/app/(dashboard)/<route>/page.tsx` |
| **large-component** | New `.tsx` in `components/` with **> 200 lines** |
| **orchestrator** | Changes to clinical/admin AI orchestrators |
| **feature-flag** | Migration adding plugin / feature flags |

Local check:

```powershell
npm run architecture:review
npm run architecture:review:strict
```

---

## 4. Review checklist (author + reviewer)

### Layers

- [ ] **Presentation** — `components/` only renders; no business rules
- [ ] **Orchestration** — multi-step flows in `lib/hooks/`
- [ ] **Business logic** — pure functions in `lib/utils/` (unit tested)
- [ ] **Data access** — `lib/actions/` + `lib/server/` only
- [ ] **Validation** — Zod schemas in `lib/validations/`; server is source of truth

### Clinical / EMR

- [ ] Patient shell preserved — no orphan routes for consult / Rx / orders
- [ ] No auto-save of clinical actions — physician confirmation
- [ ] Audit trail for sensitive mutations (`logAudit`)
- [ ] RLS + manifest updated for new tables

### Quality

- [ ] New utils have tests
- [ ] No component > 250 lines (350 hard max)
- [ ] No Supabase server client / mutations in UI
- [ ] Feature flag for risky or incremental rollout (if applicable)

### Documentation

- [ ] ADR note added when triggers fired
- [ ] PR template Architecture section completed
- [ ] Migration rollback noted (if SQL)

---

## 5. ADR note (required when triggered)

See [architecture-reviews/README.md](./architecture-reviews/README.md).

Minimum content:

1. **Context** — why now  
2. **Decision** — where each concern lives (table or bullet list)  
3. **Consequences** — tests, rollback, follow-ups  

Keep it short (½–1 page). Prefer many small ADRs over one giant doc.

---

## 6. Layer diagram (reference)

```
┌─────────────────────────────────────────────┐
│  components/  — presentation, events        │
├─────────────────────────────────────────────┤
│  lib/hooks/   — client orchestration, state   │
├─────────────────────────────────────────────┤
│  lib/utils/   — pure business logic (tests) │
├─────────────────────────────────────────────┤
│  lib/actions/ — server mutations + auth     │
│  lib/server/  — server loaders              │
├─────────────────────────────────────────────┤
│  lib/validations/ — Zod schemas             │
├─────────────────────────────────────────────┤
│  Supabase (RLS)                             │
└─────────────────────────────────────────────┘
```

---

## 7. Escalation

| Change type | Reviewers |
|-------------|-----------|
| UI / refactor only | 1 engineer |
| Migration / RLS | 1 engineer + DB owner |
| Clinical workflow / AI | 1 engineer + clinical product owner |
| Security / auth | 1 engineer + security checklist |

---

*Run full gate before merge: `npm run quality:gate`*
