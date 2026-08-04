# Security Report — Enterprise Stabilization

**Date:** 2026-07-30  
**Gate:** `npm run security:gate` ✅ · RLS static tests ✅

---

## 1. Authentication

| Control | Status |
|---------|--------|
| Supabase Auth session | ✅ |
| CSRF on auth routes | ✅ (`lib/security/csrf.ts` — 100% coverage) |
| Password reset flow | ✅ Server actions |
| Session in layout | ✅ `getSession()` cached |

---

## 2. Authorization

| Control | Status |
|---------|--------|
| Role-based permissions | ✅ `hasPermission()` — 94.7% line coverage |
| Page-level gates | ✅ Dashboard, patient, clinical routes |
| Superadmin bypass | ✅ Explicit flag |
| Feature flags | ✅ Clinic plugins |

---

## 3. Organization isolation

| Control | Status |
|---------|--------|
| `clinic_id` on all clinical tables | ✅ |
| RLS policies | ✅ 055 migrations + manifest |
| Tenant scope helper | ✅ `tenant-scope.ts` |
| Static RLS tests | ✅ `tests/rls-policies.test.ts` |

---

## 4. Data access layers

| Rule | Enforcement |
|------|-------------|
| No Supabase mutations in UI | `architecture-gate.mjs` |
| Server actions for writes | Convention + review |
| Audit logging | `logAudit()` + migration 055 immutable audit |
| Admin client isolation | Gate blocks in UI |

---

## 5. Uploads & storage

| Control | Status |
|---------|--------|
| Storage RLS | ✅ Migration 045 |
| Patient attachments clinical staff only | ✅ |
| File type validation | ✅ Server-side on upload actions |

---

## 6. Input validation

- Server actions validate with Zod/schemas
- Clinical AI routes: allowlisted task types
- Command palette patient search: authenticated API route

---

## 7. Secrets

- Env validation: `npm run validate:env:production`
- No secrets in repo (security gate scan)
- CI uses placeholder Supabase keys for build only

---

## 8. Stabilization impact

- **No new API routes** — attack surface unchanged
- **Refactored command palette** — same auth boundary on `/api/command-palette/patients`
- **Baseline gate** — prevents accidental UI-layer DB access growth

---

*See also: [SECURITY_REPORT.md](SECURITY_REPORT.md) (prior assessment) · [SECURITY_GATE.md](SECURITY_GATE.md)*
