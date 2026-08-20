# Commercial entitlements (DrFlow)

Catálogo SaaS de planes, features booleanas, cupos y estado comercial. Tenant = `clinics`.

**Status:** enforcement closed through **phase 26**. **Phase 27** = local pack verify. **Phase 31** = `db push --dry-run` against staging only (never auto-apply).

Verify local SQL pack (does not apply):

```powershell
npm run entitlements:dry-run:verify
```

Remote dry-run against **DrFlow-Staging** only (`gprmsufvhabntbrytwyi`) — does **not** apply:

```powershell
npm run entitlements:db-push:dry-run
```

Do **not** run `npx supabase db push` (without `--dry-run`) until that output is manually reviewed. Never target production (`nipqdarduknydqptqzup`). Note: `supabase/config.toml` may still list the production `project_id` for auth URL config; the CLI link / `--project-ref` for entitlement pushes must be staging.

## Migrations (staging apply order)

Apply **only** on staging (`gprmsufvhabntbrytwyi`). Never production.

```text
121_commercial_entitlements.sql
122_entitlement_superadmin.sql
123_entitlement_usage_service_role.sql
124_entitlement_usage_status.sql
125_entitlement_current_subscription.sql
126_entitlement_usage_suspend.sql
127_entitlement_trial_window.sql
128_entitlement_trial_expire.sql
```

After apply: `NOTIFY pgrst, 'reload schema';`.

## Fail-open

If catalog RPCs / migrations are missing, the app treats features as available (`catalogAvailable: false`). Core clinical (agenda, pacientes, HC, consultas, órdenes, recetas) is never gated by commercial entitlements.

## Layers

| Layer | Role |
|-------|------|
| RBAC / RLS | Can this user act in this clinic? |
| Entitlements | Did this clinic purchase the add-on / still have seats / quota? |
| Mercado Pago `clinic_subscriptions` | Billing UX (not replaced by commercial catalog) |
| `clinic_feature_flags` / plugins | UX toggles; commercial catalog can prevent enabling add-ons |

## App entry points

- Resolve: `src/core/entitlements/` (`resolve`, `requireFeature`, snapshot helpers)
- Client UX: `FeatureGate`, `AddonUpgradeNotice`, `PlanCapHint`, `isFeatureEntitledBySnapshot`
- Superadmin: `/qa/comercial`
- Plan UI: Configuración → Tu plan; marketing `/planes?modulo=`
- Types: `src/types/supabase.ts` (`npm run supabase:types` from staging); aliases in `src/types/supabase-entitlements.ts`

## Inventory (phases 1–26 — closed)

| Area | Feature keys (examples) | Gated? |
|------|-------------------------|--------|
| Core clinical | dashboard, patients, appointments, clinical records | No |
| PAMI / OS / caja / farmacología | `pami`, `insurance`, `cash_register`, `pharmacology` | Yes |
| Portal / reserva / app pacientes | `portal` | Yes |
| FHIR / integraciones | `integrations` | Yes |
| PDF comercial / data export | `pdf_export`, `data_export` | Yes (import `/datos` stays open) |
| Reportes BI | `advanced_reports` | Yes |
| API pública | `api` | Yes |
| IA / WhatsApp / telemedicina / voz | `ai*`, `whatsapp*`, `telemedicine`, `voice` + `ai.transcription` | Yes |
| Automatizaciones | `automation`, `automation.follow_up`, `automations.max_active` | Yes |
| Cupos | patients/users/professionals.max, AI/WhatsApp/transcriptions monthly, storage | Yes when catalog live |
| Estado | `past_due` / `cancelled` / `expired` pauses add-ons; overrides still win | Yes |

Upgrade-notice / point-of-use parity: API keys, agenda portal, Apps PWA + compartir app paciente, FHIR import/HC export, BI, `/datos` export, plugins/flags, Configuración hub cards, team AI + invite/ingreso seat caps, firmas storage cap, clinic voice + Apariencia, proactive-care when automation denied.

**Phase 29 — no production gating yet for existing modules:** patients, clinical history, appointments, medical orders, documents, basic/advanced reports, and **PAMI** stay available even if the catalog would deny them. Infrastructure (tables, RPCs, overrides, UI) remains; enable enforcement progressively after staging validation (`EXISTING_MODULE_ENFORCEMENT_DEFERRED` in `enforcement.ts`).

**Phase 30 — acceptance tests:** `tests/entitlements-phase30-acceptance.test.ts` covers existing→legacy/active (functionality preserved), new→trial/trialing (never legacy), plan/override/limit/temporary override matrices, unknown→DENY, usage validation, concurrent increments, and tenant isolation (read / modify / consume).

**Phase 31 — validate against staging only:** run `npm run entitlements:db-push:dry-run` (wraps `npx supabase db push --dry-run --project-ref gprmsufvhabntbrytwyi`). Review output manually before any real push. Never auto-apply; never production.

**Phase 32 — code validation (2026-08-20):** `npm run typecheck` OK; `npm run build` OK; `npm run lint` FAIL (12 `simple-import-sort` errors); `npm run test` FAIL (6 tests: clinical nav SOAP links, CSRF billing routes, prescription PAMI label, ARCO tenant-scope static). Errors not suppressed.

**Phase 33 — do not implement yet:** no new work on superadmin commercial UI, Stripe, Mercado Pago, checkout, pricing page, production gating of existing modules, new AI features, new WhatsApp integrations, or new automations. Those belong to later phases. Existing infra from phases 1–32 stays as-is (do not expand).

**Phase 34 — final report:** see chat handoff / ops checklist. Migrations **not** applied to production or staging automatically. Status: ready for staging dry-run review only.

**Safety gate (pre-apply):** `docs/STAGING_MIGRATION_SAFETY_GATE.md` + `docs/SUPABASE_ENV_SAFETY.md`. Recommendation: apply **121–128 only** on staging (110–120 are separate clinical product work).

**Selective deploy (121–128 only):** `docs/ENTITLEMENTS_SELECTIVE_STAGING_DEPLOY.md` — isolated workspace excludes 110–120; `npm run entitlements:staging:dry-run` must list exactly 121–128; apply requires `ALLOW_ENTITLEMENTS_STAGING_PUSH` + `CONFIRM_STAGING_PROJECT_REF` (not auto-run).

WhatsApp job enqueue requires both `whatsapp.enabled` and `whatsapp.reminders` (aligned with sync send).

Inventory regression: `tests/entitlements-inventory.test.ts` (FEATURES ↔ migration 121, visible modules, plugin map).

## Staging dry-run checklist (do not apply to production)

Preflight:

```powershell
npm run entitlements:dry-run:verify
npm run entitlements:db-push:dry-run
```

**Manual review gate:** do not run `npx supabase db push` until the dry-run list is approved.

Latest dry-run against `gprmsufvhabntbrytwyi` (2026-08-20) would push pending migrations **`110` → `128`** (clinical catalog work **plus** commercial entitlements `121`–`128`). Skipped by CLI name pattern: `004b_*`, `005b_*`. Nothing was applied.

Then on **staging** (`gprmsufvhabntbrytwyi`) only, after review:

1. Apply with `npx supabase db push --project-ref gprmsufvhabntbrytwyi` (or SQL Editor for a subset). Never `nipqdarduknydqptqzup` (production).
2. `NOTIFY pgrst, 'reload schema';`
3. Superadmin `/qa/comercial`: assign plan **basic** to a test clinic.
4. Confirm redirects/notices on caja, portal/apps, API, FHIR, BI; core clinical stays open.
5. Set `past_due` → extras pause; restore `active` → extras return.
6. Optional: trial window / expire (127–128) on a throwaway clinic.
7. Confirm fail-open: with catalog missing (pre-121), add-ons stay available.

PowerShell tip when chaining commands: use `; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }` (no `&&`).

## Explicitly deferred / unused

| Item | Notes |
|------|-------|
| **Phase 33 freeze** | Do **not** implement yet: superadmin interface expansion, Stripe, Mercado Pago changes, checkout, pricing page, production gating, new AI, new WhatsApp integrations, new automations |
| `branding.enabled` | In catalog; **no logo UI** — leave unused |
| Server transcription consume | Browser STT only; no server STT meter burn |
| `/datos` imports | Not gated |
| `wa.me` deep links | Not blocked |
| `generate_report` / `send_email` jobs | Intentionally ungated (core ops) |
| Mercado Pago cancel / `past_due` sync | Do not invent |
| Stripe / AFIP / DPA checkout | Out of scope |
| Production gating (existing modules) | Phase 29 — keep deferred until staging validation |
| Pricing / checkout UX | Later phases — see [MONETIZACION-PLAN.md](./MONETIZACION-PLAN.md); do not build now |

## Related

See also [MONETIZACION-PLAN.md](./MONETIZACION-PLAN.md) for pricing/trial UX. Commercial catalog is the enforcement layer described here.
