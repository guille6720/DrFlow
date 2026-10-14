# Phase 0H — Migration safety and recovery (production)

Status: **prepared and rehearsed locally; nothing applied to any remote database.**
Every remote step below needs explicit approval. Never store secrets or patient data in Git.

## Files

| File | Purpose |
|------|---------|
| `scripts/sql/VERIFY_BATCH1_BATCH2_PRODUCTION.sql` | Read-only state report; run before and after every batch |
| `supabase/migrations/rollback/20260928155026_hardening_clinic_products_grants.down.sql` | Exact restore of pre-hardening `clinic_products` privileges |
| `supabase/migrations/20261014120000_medical_orders_v2_guard_clinical_purge_detach.sql` | D4 forward fix (Batch 3 only) |
| `supabase/migrations/rollback/20261014120000_medical_orders_v2_guard_clinical_purge_detach.down.sql` | Restores the original v2 guard |
| `supabase/scripts/recovery-medical-orders-v2-freeze.sql` / `-unfreeze.sql` | Preferred v2 recovery: containment |
| `supabase/scripts/recovery-medical-orders-v2-full-rollback.sql` | Last-resort destructive v2 rollback (replaces the shipped `.down.sql`) |
| `tests/medical-orders-v2-recovery.test.ts` | Static guarantees for the files above |

## Rules for every batch

1. One batch = one transaction: `psql -v ON_ERROR_STOP=1 -1 -f <file> -f <file> ...`, run as `postgres`.
   Never apply files one by one and continue after an error.
2. Set `lock_timeout = '5s'` and `statement_timeout = '60s'` for the session; retry in a quieter window on timeout.
3. Do **not** use `supabase db push` or `supabase migration repair` (production records only 20 versions).
   Recording these versions in `supabase_migrations.schema_migrations` is a separate, approved step.
4. Run `VERIFY_BATCH1_BATCH2_PRODUCTION.sql` before and after; keep both outputs with the change record.
5. Batch 3 is out of scope until its own approval.

## Backup requirements

| When | Requirement |
|------|-------------|
| Before Batch 1 or 2 | Confirm PITR is enabled and note the restore timestamp, or take a logical backup (schema + `clinic_products`, `audit_logs`). Save the pre-change `VERIFY` output (contains the exact `clinic_products` ACL). |
| Before Batch 3 | PITR restore point **and** a logical export of `medical_orders`, `clinical_records`, `audit_logs`, `clinic_role_permissions`, `clinic_member_permissions`. Restore rehearsal of that export on a disposable database. |
| Before any destructive v2 recovery | Fresh PITR point + external export of all v2 tables; written approval from clinical and legal owners. |

Backups must stay outside the repository and outside developer machines' synced folders (they contain PHI).

## Batch 1 — `20260928120000`, `20260929130000`, `20260930120000`

Additive: creates `feature_definitions`, `clinic_feature_settings`, `user_feature_settings` (RLS on, no client writes,
audited SECURITY DEFINER setters with `search_path = public`, no `anon` execute) and seeds RCTA/PAMI definitions.
Application behavior does not change: `resolveFeatureMap` starts from code defaults and the settings tables start empty.

Pre-checks (expected `VERIFY` values):
- `prereq_function_*` = `present` (6 of 6); `audit_logs_missing_columns` = `none`; `audit_action_has_create_update_delete` = `true`
- `table_feature_definitions`, `table_clinic_feature_settings`, `table_user_feature_settings` = `absent`

Apply: `-1 -f 20260928120000_feature_customizations.sql -f 20260929130000_rcta_integration_feature.sql -f 20260930120000_pami_integration_feature.sql`

Post-checks:
- the three tables `present`, `rls_enabled_*` = `true`; `feature_definitions_keys` lists 18 keys including `rcta_*` and `pami_*`, and **not** `national_electronic_prescription`
- `anon_execute_on_new_rpcs` = `none`; every `new_secdef_functions_search_path` entry shows `search_path=public`
- Smoke: a doctor and a secretary log in; agenda, patients, prescriptions and the settings page load as before

Rollback (one transaction): `rollback/20260930120000_*.down.sql`, `rollback/20260929130000_*.down.sql`,
`rollback/20260928120000_*.down.sql`. Loses only settings created after the batch; audit rows remain.

## Batch 2 — `20260928155026`, `20260928203000`, `20260928220000`

- `20260928155026` revokes the Supabase default privileges on `clinic_products` from `anon`/`authenticated`
  and keeps `SELECT` for `authenticated` (the intent of migration 158). All writes already go through
  SECURITY DEFINER functions (`set_clinic_product`, `seed_clinic_products_on_clinic_insert`); reads use RLS or `get_clinic_products`.
- `20260928203000` / `20260928220000` add per-clinic role permission overrides (clinic admins edit doctor/secretary
  only, whitelisted keys, audited).

Pre-checks: Batch 1 post-checks hold; `table_clinic_role_permissions` = `absent`;
`clinic_products_acl` = `anon=arwdDxtm/postgres authenticated=arwdDxtm/postgres postgres=arwdDxtm/postgres service_role=arwdDxtm/postgres`
(on PostgreSQL < 17 the letters are `arwdDxt`). **If the ACL differs, stop and update the grant rollback first.**

Apply: `-1 -f 20260928155026_hardening_clinic_products_grants.sql -f 20260928203000_clinic_role_permissions.sql -f 20260928220000_clinic_role_permissions_geriatrics.sql`

Post-checks:
- `clinic_products_acl` = `authenticated=r/postgres postgres=arwdDxtm/postgres service_role=arwdDxtm/postgres`
- `table_clinic_role_permissions` = `present`, RLS `true`; `clinic_role_permissions_key_check` references `clinic_manageable_permission_keys()`
- Smoke: product gating (clinic / geriatrics) unchanged for a normal clinic and a geriatrics clinic; superadmin can toggle a product;
  creating a clinic seeds its products; clinic admin opens the role-permissions matrix

Rollback (one transaction): `rollback/20260928220000_*.down.sql`, `rollback/20260928203000_*.down.sql`, then — only if the
grant hardening itself caused the problem — `rollback/20260928155026_hardening_clinic_products_grants.down.sql`.

### `clinic_products` grant rollback

The rollback restores the exact documented pre-change ACL with an enumerated privilege list (`MAINTAIN` only on PostgreSQL 17+),
refuses to run unless the current state is exactly the post-hardening state, and aborts unless the final ACL matches.
It must be run as the table owner.

Security implications of restoring it: `anon` and `authenticated` regain `TRUNCATE` (not subject to RLS — one statement
empties every clinic's product rows), `MAINTAIN` (`LOCK TABLE`, `VACUUM`, `REINDEX`), `TRIGGER`, `REFERENCES` and DML.
PostgREST cannot issue `TRUNCATE`/`LOCK`, and DML stays denied because the table has no write policies, so exposure needs
another SQL execution path. Treat a restore as temporary and re-apply the hardening as soon as the outage cause is fixed.

## Batch 3 — medical orders v2 (not approved)

Order: `20260929100000`, `20260929110000`, `20261014120000` in **one** transaction. Production code is already v2-ready,
so applying it enables structured medical orders for all clinics immediately. Requires product and privacy sign-off
(anonymous verification shows patient initials, masked document, professional, license, clinic), the backups above,
and a low-traffic window (exclusive lock on `medical_orders` while four checks validate and five indexes build).

### Recovery ladder (once real v2 orders exist)

1. **Forward fix** (new migration) — always preferred.
2. **Containment** — `recovery-medical-orders-v2-freeze.sql`: blocks creating and issuing v2 orders; existing documents,
   numbering, hashes, QR verification, immutability, delete protection, annulment and legacy orders keep working.
   Reversible with `recovery-medical-orders-v2-unfreeze.sql`. The UI shows a generic "No se pudo guardar la orden." while frozen.
3. **Point-in-time restore** to a separate project for investigation; never overwrite production without approval.
4. **Destructive rollback** — `recovery-medical-orders-v2-full-rollback.sql`, last resort only.

Do not use `rollback/20260929100000_medical_orders_v2.down.sql` in production: it fails on a dependency
(`can_view_medical_orders` dropped before `medical_order_items`), and even when reordered it leaves the v2 columns, so the
running application keeps creating v2 orders with no numbering, hash or immutability.

What the destructive rollback loses: structured fields (category, number, diagnosis, indication, priority, validity,
patient/issuer snapshots, hash, void data), order items, clinic catalog entries, numbering counters and secretary
medical-order grants. Rows survive as legacy orders and a copy stays in schema `rollback_export` (not exposed to the API),
but **every printed or shared QR link stops verifying**, and if v2 is re-applied later numbering restarts at
`OM-<year>-00000001`, duplicating numbers already printed. It refuses to run while issued/void v2 orders exist unless the
operator sets `nexclinic.confirm_v2_data_loss = 'EXPORTED_AND_APPROVED'` in the same session.

## Known risks outside these batches

- In a clean replay, `anon` and `authenticated` hold `TRUNCATE` on 94 of 112 public tables (Supabase default privileges).
  Production was verified only for `clinic_products`; check the rest read-only and plan a separate hardening.
- `purge_clinic_clinical_data_for_migration` leaves `app.allow_clinical_hard_delete` set until the calling transaction
  ends. Via PostgREST each RPC is its own transaction; server code must not run other writes in the same transaction.
