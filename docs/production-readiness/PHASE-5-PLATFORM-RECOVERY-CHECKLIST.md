# Phase 5 — Platform recovery checklist (post Postgres restore)

Use after restoring DrFlow-Staging database to a **new** Supabase project.  
**Never store secret values in Git** — record only variable names and recovery locations.

## Database recovery (Postgres)

| Step | Action | Verified |
|------|--------|----------|
| 1 | Restore via PITR or physical backup to **new project** | ☐ |
| 2 | Confirm migration version / schema (`npm run validate:schema:live`) | ☐ |
| 3 | Run `npm run phase5:dr:validate` against new project URL/keys | ☐ |
| 4 | Re-run tenant isolation (`npm run phase3:tenant-isolation:staging`) | ☐ |
| 5 | Verify RLS enabled on clinical tables | ☐ |

## Auth configuration

| Item | Recovery location |
|------|-------------------|
| JWT secret / JWT expiry | Supabase → Authentication → Settings (auto on new project — **must match app** or repoint app to restored project) |
| Site URL | Supabase → Auth → URL configuration |
| Redirect URLs | Supabase → Auth → URL configuration + `npm run deploy:checklist` |
| OAuth providers (Google, etc.) | Supabase → Auth → Providers |
| Email templates / SMTP | Supabase → Auth → Email OR app `SMTP_*` in Vercel |
| MFA / AAL settings | Supabase → Auth → MFA |

## API keys & application env (Vercel staging)

| Variable | Recovery location |
|----------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | New project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `ANON_KEY` | New project → API keys |
| `SUPABASE_SERVICE_ROLE_KEY` | New project → API keys (rotate if compromised) |
| `DATABASE_URL` | New project → Database → Connection string (operator vault only) |
| `OPS_ALERT_WEBHOOK_URL` | Vercel → Environment Variables |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry project + Vercel |
| `DRFLOW_SENTRY_STAGING` | Vercel (`1` for staging capture) |
| Mercado Pago / billing secrets | Vercel + MP dashboard |
| Webhook secrets | Vercel |

## Realtime, extensions, Edge Functions

| Component | Notes |
|-----------|-------|
| Realtime | Enabled per-table in Supabase → Database → Publications |
| Extensions (`pg_stat_statements`, etc.) | Re-apply migrations if fresh project; restored DB retains |
| Edge Functions | Redeploy from repo if new empty project |
| Storage buckets | **`clinical-files`** — DB restore does **not** restore objects; run storage DR separately |

## Storage recovery (separate from DATABASE)

| Step | Action |
|------|--------|
| 1 | Confirm bucket `clinical-files` exists (migration 028) |
| 2 | Restore objects from backup OR accept metadata-only gap |
| 3 | Run `npm run phase5:dr:storage-integrity` |
| 4 | Document attachment gaps for clinical ops |

## Network & webhooks

| Item | Location |
|------|----------|
| Network restrictions | Supabase → Database → Network |
| Mercado Pago webhook URL | MP dashboard → must point to live staging URL |
| Vercel deployment | Promote last known-good or redeploy branch |

## Sign-off

| Role | Name | Date |
|------|------|------|
| DBA / Supabase admin | | |
| On-call engineering | | |
| Product / clinic comms | | |
