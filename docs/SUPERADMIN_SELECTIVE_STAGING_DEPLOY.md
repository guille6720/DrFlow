# Selective Superadmin staging deploy (129 only)

## Commands

```powershell
npm run superadmin:staging:history
npm run superadmin:staging:dry-run
```

After human approval of dry-run (exactly `129_superadmin_commercial_control.sql`):

```powershell
$env:ALLOW_SUPERADMIN_STAGING_PUSH="1"
$env:CONFIRM_STAGING_PROJECT_REF="gprmsufvhabntbrytwyi"
npm run superadmin:staging:apply
npm run superadmin:staging:verify
```

Production (`nipqdarduknydqptqzup`) is never targeted.

## Method

Isolated temporary workspace under `.tmp-superadmin-staging-push/` copies:

* all repo migrations **except** `110`–`120`
* including already-applied `001`–`109` and `121`–`128`
* plus Superadmin `129`

Then `supabase db push --dry-run --project-ref gprmsufvhabntbrytwyi` from that workspace.

The script **ABORT**s if pending is anything other than exactly:

```text
129_superadmin_commercial_control.sql
```

Main `supabase/migrations/` is never renamed, deleted, or repaired.

## Explicitly out of scope

Do **not** include or apply with this workflow:

* migrations `110`–`120` (trabajo clínico DX/TX)
* `data/anmat` dumps
* `test-results/`
* `.tmp-*` workspaces
* cualquier cambio de aplicación no relacionado con Superadmin / 129
