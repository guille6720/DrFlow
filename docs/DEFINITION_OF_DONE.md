# Definition of Done — DrFlow

**Version:** 1.0  
**Effective:** 2026-07-30  
**Applies to:** Every feature, bug fix, refactor, migration, and pull request

> A task is **not complete** until **every** item below is satisfied. CI enforces the automated items; reviewers enforce the rest.

---

## 1. Build & static analysis

| # | Requirement | Enforced by |
|---|-------------|-------------|
| 1 | Builds successfully (`npm run build`) | CI |
| 2 | TypeScript zero errors on app source (`npm run typecheck`) | CI |
| 3 | ESLint zero errors **and** zero warnings (`npm run lint`) | CI + pre-commit |
| 4 | No unused imports | ESLint |
| 5 | No dead code introduced | Review + architecture gate |
| 6 | No `TODO` / `FIXME` in `src/` | `code-quality-gate.mjs` |
| 7 | No `eslint-disable` | `code-quality-gate.mjs` |
| 8 | No unsafe `any` | ESLint + code-quality gate |
| 9 | No `@ts-ignore` / `@ts-nocheck` | ESLint + code-quality gate |

---

## 2. Tests

| # | Requirement | Enforced by |
|---|-------------|-------------|
| 10 | All automated tests pass (`npm test`) | CI |
| 11 | Core lib coverage ≥ **90%** | `check:coverage` |
| 12 | Critical modules ≥ **95–100%** (see below) | `check:critical-coverage` |
| 13 | Unit tests added or updated for changed logic | Review |
| 14 | Integration tests updated when API/RLS changes | Review + `test:rls:static` |
| 15 | E2E smoke passes when routes/auth change | CI e2e job |
| 16 | Performance benchmarks pass (`performance:gate`) | CI |

### Critical coverage modules (minimum)

| Module | Minimum |
|--------|---------|
| `src/lib/permissions/**` | 95% |
| `src/lib/security/**` (except server-only helpers) | 95% |
| Auth helpers (`csrf`, `tenant-scope`) | **100%** |
| Patient workflow utils | 95% |
| Prescription / clinical assistant utils | 95% |
| Medical record / timeline utils | 95% |

---

## 3. Architecture

| # | Requirement | Enforced by |
|---|-------------|-------------|
| 17 | **SOLID**, **DRY**, **KISS**, Clean / Feature-based architecture | Review + architecture gate |
| 18 | Business logic **never** in UI components — use `lib/`, hooks, server actions | Architecture gate |
| 19 | Single Responsibility — components ≤ **350** lines (target ≤ 250) | Architecture gate |
| 20 | No duplicated logic | Review |
| 21 | No direct Supabase mutations from `src/components/` | Security gate |

---

## 4. UX & UI states

| # | Requirement | Enforced by |
|---|-------------|-------------|
| 22 | Loading states for async operations | Review |
| 23 | Empty states for lists / search | Review |
| 24 | Error states with actionable messages | Review |
| 25 | Responsive behavior verified (mobile + desktop) | Review |
| 26 | Accessibility preserved (WCAG-oriented patterns) | Review + a11y tests |

---

## 5. Performance

| # | Requirement | Enforced by |
|---|-------------|-------------|
| 27 | No large bundles without lazy loading | Review |
| 28 | No N+1 queries or request waterfalls | Review |
| 29 | No unnecessary re-renders (React Compiler–friendly patterns) | Review |
| 30 | Performance unchanged or improved | `performance:gate` |

---

## 6. Security

| # | Requirement | Enforced by |
|---|-------------|-------------|
| 31 | Auth/authz unchanged or improved | Review + security tests |
| 32 | RLS validated for new tables | `test:rls:static` + migration |
| 33 | Organization / clinic scoping on all tenant data | Review |
| 34 | No XSS, SQL injection, unsafe uploads, secret exposure | `security-gate.mjs` |
| 35 | Permission checks on every protected action | Review |

See [SECURITY_GATE.md](../SECURITY_GATE.md).

---

## 7. Medical software (EMR/EHR)

| # | Requirement | Enforced by |
|---|-------------|-------------|
| 36 | **Patient safety** — no unconfirmed clinical actions | Review |
| 37 | **Auditability** — immutable audit for sensitive changes | Migration 055 + `logAudit` |
| 38 | **Data integrity** — no silent data loss | Review + tests |
| 39 | **Traceability** — who/when/what in audit trail | Audit logging |
| 40 | **Rollback** documented for migrations | PR template |
| 41 | **Clinical workflow consistency** with existing patterns | Review |
| 42 | Physician confirmation for all AI-generated content | Feature flags + UI |

---

## 8. Code hygiene

| # | Requirement | Enforced by |
|---|-------------|-------------|
| 43 | No `console.log` in production `src/` (use `devLog` or structured logging) | code-quality gate |
| 44 | Error handling implemented — no swallowed failures | Review |
| 45 | Production build succeeds | CI |

---

## 9. Documentation

| # | Requirement | Enforced by |
|---|-------------|-------------|
| 46 | User-facing or ops docs updated when behavior changes | PR checklist |
| 47 | Migration documented in PR when SQL changes | PR template |
| 48 | API / env changes reflected in `.env.example` | Review |

---

## 10. Release readiness

Before merge to `main`:

```powershell
npm run quality:gate:fast   # typecheck, lint, gates, tests, coverage (no build)
npm run quality:gate        # full gate including build
```

Or rely on CI **`quality-gate`** job (required).

---

## Sign-off

| Role | Responsibility |
|------|----------------|
| Author | All automated gates green; PR checklist complete |
| Reviewer | Architecture, security, clinical safety |
| Release manager | Migration + rollback plan for prod deploys |

---

*Related: [ENGINEERING_STANDARDS.md](./ENGINEERING_STANDARDS.md) · [TESTING.md](./TESTING.md)*
