# Engineering Standards — DrFlow

**Version:** 1.0  
**Audience:** All contributors  
**Companion:** [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md)

---

## 1. Architecture principles

| Principle | Application in DrFlow |
|-----------|----------------------|
| **SOLID** | Single-purpose modules; inject dependencies via hooks/services |
| **DRY** | Shared utils in `src/lib/utils/`; no copy-paste clinical logic |
| **KISS** | Prefer explicit code over clever abstractions |
| **Clean Architecture** | UI → hooks/actions → services → Supabase |
| **Feature-based** | Domain modules in `src/features/` (e.g. caja) |

### Layer rules

```
src/app/          → Routes, layouts, thin page shells
src/components/   → Presentation only (no business rules)
src/lib/hooks/    → Client state + orchestration
src/lib/actions/  → Server actions (auth, validation, mutations)
src/lib/server/   → Server-only loaders
src/lib/utils/    → Pure functions (testable, 90%+ coverage)
src/lib/security/ → Authz, audit, RLS manifest
src/features/     → Vertical feature slices
```

**Reject:** Supabase mutations, permission checks, or clinical algorithms inside `src/components/`.

---

## 2. Naming conventions

| Artifact | Convention | Example |
|----------|------------|---------|
| Components | PascalCase | `PatientChartGrid.tsx` |
| Hooks | `use` + camelCase | `usePatientChart.ts` |
| Utils | camelCase functions | `normalizeDni.ts` |
| Server actions | verb + noun | `cancelPatientAppointment` |
| Types | PascalCase | `PatientEhrWorkspaceData` |
| Constants | SCREAMING_SNAKE | `PATIENT_EHR_RECORD_LIMIT` |
| Migrations | `NNN_description.sql` | `055_immutable_audit_logging.sql` |
| Tests | mirror source + `.test.ts` | `tenant-scope.test.ts` |

---

## 3. Folder structure

```
DrFlow/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # UI (by domain: pacientes, historias, …)
│   ├── features/         # Feature modules
│   ├── lib/              # Core logic
│   └── plugins/          # Plugin registry
├── supabase/migrations/  # Ordered SQL migrations
├── tests/                # Vitest unit/integration
├── e2e/                  # Playwright smoke
├── scripts/              # Ops + quality gates
└── docs/                 # Engineering & runbooks
```

---

## 4. Component rules

- Max **350** lines (CI architecture gate); target **≤ 250**
- `"use client"` only when needed (interactivity, hooks)
- Server Components for data fetching — no client-side waterfall
- Extract forms into dedicated components + hooks
- Use existing UI primitives (`src/components/ui/`)
- Loading / empty / error states required for async UI

---

## 5. Hook rules

- One hook per cohesive concern (`use-agenda-view`, not `useEverything`)
- Server calls via server actions — not raw Supabase in hooks when avoidable
- `useCallback` / `useMemo` only when measurable benefit or ESLint requires
- No `eslint-disable` for exhaustive-deps — fix dependencies

---

## 6. Database rules

- Every clinic-scoped table: **RLS enabled** + policies in migrations
- Add table to `src/lib/security/rls-manifest.ts`
- FKs indexed; audit sensitive mutations via `logAudit()`
- Migrations are **forward-only** in production — no destructive down migrations
- Test static RLS: `npm run test:rls:static`

---

## 7. Supabase rules

- **Anon key** — client only, RLS-protected
- **Service role** — server/cron only; never in components
- All queries scoped by `clinic_id` / tenant helpers
- Storage uploads: validate MIME, size, clinic ownership
- Cron routes protected with `CRON_SECRET`

---

## 8. Testing strategy

| Layer | Tool | When |
|-------|------|------|
| Unit | Vitest | Every util, hook logic, permission check |
| Coverage | v8 | Core lib 90%; critical 95–100% |
| RLS static | Vitest + SQL manifest | New tables/migrations |
| RLS integration | Vitest + Supabase | Before major releases |
| Performance | Vitest benchmarks | Parse/search hot paths |
| E2E smoke | Playwright | Route/API regressions |
| Accessibility | Vitest + manual | Focus, labels, contrast |

```powershell
npm test
npm run check:coverage
npm run test:rls:static
npm run test:e2e
npm run quality:gate
```

---

## 9. Error handling

- Server actions return `{ error?: string }` — never throw to client for expected failures
- User-facing errors in Spanish, actionable
- Unexpected errors logged via observability (`recordObservabilityEvent`)
- Clinical errors must not expose other patients' data

---

## 10. Logging

| Context | Method |
|---------|--------|
| Development diagnostics | `devLog()` from `src/lib/observability/dev-log.ts` |
| Production ops | `console.warn` / `console.error` only |
| Security / clinical audit | `logAudit()` → immutable tables |
| Telemetry | `clinic_observability_events` |

**Never** `console.log` in `src/` production paths.

---

## 11. Monitoring

- Health: `/api/health/live`, `/api/health/ready`
- Uptime: GitHub Actions + optional external monitor
- Observability panel in Configuración
- **Recommended:** Sentry for error tracking (see `PRODUCTION_READINESS_REPORT.md`)

---

## 12. Review process

1. Author completes [PR checklist](../.github/pull_request_template.md)
2. CI `quality-gate` must pass
3. Reviewer checks: architecture, security, clinical safety, a11y
4. DB changes: second reviewer for migrations
5. Merge to `main` → Vercel deploy

---

## 13. Quality commands

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint zero warnings |
| `npm run typecheck` | TypeScript app source |
| `npm run code-quality:gate` | TODO, console.log, any, eslint-disable |
| `npm run security:gate` | XSS, secrets, RLS manifest, npm audit |
| `npm run architecture:gate` | Component size, UI/service separation |
| `npm run performance:gate` | Benchmarks + component metrics |
| `npm run quality:gate` | Full enterprise gate |

---

*Related: [TESTING.md](./TESTING.md) · [SECURITY_GATE.md](../SECURITY_GATE.md)*
