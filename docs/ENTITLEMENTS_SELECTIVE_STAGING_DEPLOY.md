# Selective entitlements staging deploy (121–128 only)

## Commands

```powershell
npm run entitlements:staging:history
npm run entitlements:staging:dry-run
```

After human approval of dry-run (exactly 121–128):

```powershell
$env:ALLOW_ENTITLEMENTS_STAGING_PUSH="1"
$env:CONFIRM_STAGING_PROJECT_REF="gprmsufvhabntbrytwyi"
npm run entitlements:staging:apply
npm run entitlements:staging:verify
```

Production is never targeted.

## Method

An isolated temporary workspace under `.tmp-entitlements-staging-push/` copies:

* all repo migrations **except** `110`–`120`
* including already-applied `001`–`109` (so remote history matches)
* plus entitlements `121`–`128`

Then `supabase db push --dry-run --project-ref gprmsufvhabntbrytwyi` from that workspace.

The script **fails** if pending includes anything outside 121–128.

Main `supabase/migrations/` is never renamed, deleted, or repaired.

## Future: applying 110–120 after 121–128

After entitlements-only apply, remote history looks like:

```text
… 109 applied
110–120 missing
121–128 applied
```

Supabase will treat `110`–`120` as **out-of-order** pending migrations (version numbers before already-applied 121).

**Safe future procedure (clinical product track, separate change window):**

1. `npm run supabase:preflight:staging`
2. From the **main** repo (full migration folder):  
   `npx supabase db push --dry-run --project-ref gprmsufvhabntbrytwyi`
3. Expect pending `110`–`120` only (121–128 already remote).
4. If the CLI refuses out-of-order versions, use:  
   `npx supabase db push --include-all --dry-run --project-ref gprmsufvhabntbrytwyi`  
   Review carefully — `--include-all` is required when local versions are lower than the latest remote version but still unapplied.
5. After dry-run approval, apply with the same flags (still staging only).
6. Re-run entitlements verify / clinical smoke tests.

**Why this does not damage 121–128:**  
110–120 only touch clinical DX/TX / import / jobs objects. They do not `DROP` entitlements tables or rewrite `clinic_entitlement_*` RPCs. Additive clinical schema can coexist with the commercial catalog.

**Do not** mark 110–120 as applied via `migration repair` without executing their SQL.
