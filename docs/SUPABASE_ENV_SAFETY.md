# Supabase environment safety (DrFlow)

| Env | Project ref | Role |
|-----|-------------|------|
| **DrFlow-Staging** | `gprmsufvhabntbrytwyi` | Entitlements migrations / dry-run / types |
| **DrFlow production** | `nipqdarduknydqptqzup` | Live users — never auto-push from entitlements work |

## Important

`supabase/config.toml` may still list the **production** `project_id` for auth Site URL / redirect tooling (`supabase config push`). That is **not** the target for `db push` during commercial entitlements work.

## Commands

```powershell
npm run supabase:preflight:staging
npm run entitlements:db-push:dry-run
```

Real staging push (only after manual dry-run review):

```powershell
$env:ALLOW_STAGING_DB_PUSH="1"
$env:CONFIRM_STAGING_DB_PUSH="gprmsufvhabntbrytwyi"
npm run supabase:db-push:staging
```

Production migrate script requires a **separate** explicit workflow (`ALLOW_PRODUCTION_DB=1` + `CONFIRM_PRODUCTION_DB=nipqdarduknydqptqzup`). Do not use it for entitlements staging.
