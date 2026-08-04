# Security Gate — DrFlow

**Version:** 1.0  
**Enforcement:** `scripts/security-gate.mjs` (CI + local)  
**Companion:** [SECURITY_REPORT.md](./SECURITY_REPORT.md)

---

## Purpose

Automatically **reject** changes that introduce common EMR security vulnerabilities before merge.

---

## CI integration

```yaml
# .github/workflows/ci.yml
- name: Security gate
  run: node scripts/security-gate.mjs
```

Local:

```powershell
npm run security:gate
```

---

## Checks performed

### 1. Static code patterns (`src/`)

| Pattern | Severity | Action |
|---------|----------|--------|
| Hardcoded secrets (JWT, service role, CRON_SECRET) | Critical | **Fail** |
| `eval()` | Critical | **Fail** |
| `.innerHTML =` | High | **Fail** |
| `dangerouslySetInnerHTML` | High | **Fail** (allowlist: theme bootstrap only) |
| `createAdminClient` in components | Critical | **Fail** |
| Direct Supabase `.insert/.update/.delete` in components | High | **Fail** |

### 2. RLS manifest

- Verifies `src/lib/security/rls-manifest.ts` exists
- `TABLES_REQUIRING_RLS` must be maintained for every clinic-scoped table

Static audit: `npm run test:rls:static`

### 3. Dependency audit

- `npm audit --omit=dev --json`
- **Fails** on high/critical advisories not in allowlist

#### Current allowlist (tracked debt)

| Package | Reason | Remediation |
|---------|--------|-------------|
| `xlsx` | Prototype pollution / ReDoS — no fix available | Replace with maintained fork or server-side only parsing |
| `sharp` | Transitive via Next.js — libvips CVEs | Upgrade Next.js when patched sharp available |

---

## Authorization requirements (review)

Every PR touching auth/authz must verify:

| Check | Reference |
|-------|-----------|
| Permission helper used | `hasPermission`, `requireClinicPermission` |
| Clinic scoping | `getActiveClinicId`, `tenant-scope.ts` |
| RLS policies for new tables | Migration + manifest |
| Cron routes protected | `CRON_SECRET` bearer |
| Audit logging for sensitive ops | `logAudit()` migration 055 |

---

## Authentication requirements

| Rule | Status |
|------|--------|
| Supabase Auth for users | ✅ |
| Middleware session refresh | ✅ |
| CSRF on mutations | ✅ `src/lib/security/csrf.ts` |
| Production env validation | ✅ `src/lib/env.server.ts` |
| Password reset URL safety | ✅ |

---

## XSS prevention

- CSP headers in `vercel.json` + `response-headers.ts`
- Clinical display sanitized: `sanitize-clinical-display.ts`
- No raw HTML rendering except allowlisted theme script

---

## Upload safety

- Server Actions body limit: 12 MB
- Clinical file storage via Supabase Storage + RLS
- PDF parsing server-side only (`serverExternalPackages`)

---

## Secret management

| Secret | Location |
|--------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (server only) |
| `CRON_SECRET` | Vercel env (≥ 16 chars) |
| `DATABASE_URL` | Ops/backup only |

Validate: `npm run validate:env:production`

**Never** commit `.env.local` or hardcode secrets in source.

---

## SQL injection

- All DB access via Supabase client (parameterized)
- RPC functions use typed parameters in migrations
- No string-concatenated SQL in application code

---

## Medical data integrity

- Audit tables **immutable** (migration 055)
- TRUNCATE/DELETE revoked on audit tables
- Cross-tenant tests: `tests/cross-tenant-rls.integration.test.ts` (manual/optional CI)

---

## Failure response

If security gate fails:

1. Read CI log for specific violation
2. Fix pattern or add allowlist entry (requires security review + doc update)
3. Re-run `npm run security:gate`
4. Never bypass gate without documented exception in this file

---

## Roadmap

| Item | Priority |
|------|----------|
| Replace `xlsx` dependency | P1 |
| Upgrade Next/sharp for CVEs | P1 |
| Sentry security event tracking | P1 |
| RLS integration in CI | P1 |
| OWASP ZAP / DAST scan | P2 |

---

*Related: [DEFINITION_OF_DONE.md](./docs/DEFINITION_OF_DONE.md) · [AUDIT_LOGGING.md](./AUDIT_LOGGING.md)*
