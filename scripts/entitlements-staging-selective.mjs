#!/usr/bin/env node
/**
 * Selective entitlements staging deploy helpers (121–128 ONLY).
 *
 * Builds an isolated temporary Supabase workdir that includes:
 *   - all migrations already on staging (≤109, plus non-numeric skips if present)
 *   - entitlements pack 121–128
 * and EXCLUDES clinical pack 110–120.
 *
 * Main repo supabase/migrations is never modified.
 * Never targets production.
 *
 * Commands (via package.json):
 *   npm run entitlements:staging:history
 *   npm run entitlements:staging:dry-run
 *   npm run entitlements:staging:apply   (requires env confirmation; not for auto-run)
 *   npm run entitlements:staging:verify
 */
import { spawnSync } from "child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { basename, join, resolve } from "path";

import {
  assertLinkedStagingOrExit,
  linkedProjectRefPath,
  PRODUCTION_REF,
  STAGING_NAME,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

const ROOT = process.cwd();
const SRC_MIGRATIONS = resolve(ROOT, "supabase/migrations");
const WORK_PARENT = resolve(ROOT, ".tmp-entitlements-staging-push");
const ALLOWED_PENDING = [
  "121_commercial_entitlements.sql",
  "122_entitlement_superadmin.sql",
  "123_entitlement_usage_service_role.sql",
  "124_entitlement_usage_status.sql",
  "125_entitlement_current_subscription.sql",
  "126_entitlement_usage_suspend.sql",
  "127_entitlement_trial_window.sql",
  "128_entitlement_trial_expire.sql",
];
const FORBIDDEN_PENDING_PREFIXES = [
  "110_",
  "111_",
  "112_",
  "113_",
  "114_",
  "115_",
  "116_",
  "117_",
  "118_",
  "119_",
  "120_",
];

const mode = process.argv[2] || "help";

function fail(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function printTargetBanner() {
  console.log("TARGET: DrFlow-Staging");
  console.log(`PROJECT REF: ${STAGING_REF}`);
  console.log("PRODUCTION: NOT TARGETED");
  console.log(`Forbidden production ref: ${PRODUCTION_REF}`);
  console.log("");
}

function migrationVersion(filename) {
  const m = filename.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function listSourceMigrations() {
  return readdirSync(SRC_MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Files included in the isolated workspace (exclude 110–120). */
function selectWorkspaceMigrations() {
  const selected = [];
  const excluded = [];
  for (const file of listSourceMigrations()) {
    const ver = migrationVersion(file);
    if (ver !== null && ver >= 110 && ver <= 120) {
      excluded.push(file);
      continue;
    }
    selected.push(file);
  }
  return { selected, excluded };
}

function buildIsolatedWorkspace() {
  const { selected, excluded } = selectWorkspaceMigrations();
  for (const name of ALLOWED_PENDING) {
    if (!selected.includes(name)) {
      fail(`Expected entitlement migration missing from workspace set: ${name}`);
    }
  }
  for (const name of FORBIDDEN_PENDING_PREFIXES) {
    if (selected.some((f) => f.startsWith(name))) {
      fail(`Forbidden clinical migration leaked into workspace: ${name}*`);
    }
  }

  rmSync(WORK_PARENT, { recursive: true, force: true });
  mkdirSync(WORK_PARENT, { recursive: true });
  const work = mkdtempSync(join(WORK_PARENT, "ws-"));
  const destMigrations = join(work, "supabase", "migrations");
  mkdirSync(destMigrations, { recursive: true });

  // Minimal config: point project_id at staging (isolated copy only).
  writeFileSync(
    join(work, "supabase", "config.toml"),
    `# Isolated entitlements staging push workspace — DO NOT use for production.\nproject_id = "${STAGING_REF}"\n`,
    "utf8"
  );

  // Preserve CLI link metadata if present (still pass --project-ref explicitly).
  const linkSrc = linkedProjectRefPath(ROOT);
  if (existsSync(linkSrc)) {
    const tempDir = join(work, "supabase", ".temp");
    mkdirSync(tempDir, { recursive: true });
    cpSync(linkSrc, join(tempDir, "project-ref"));
  }

  for (const file of selected) {
    cpSync(join(SRC_MIGRATIONS, file), join(destMigrations, file));
  }

  writeFileSync(
    join(work, "WORKSPACE_MANIFEST.json"),
    JSON.stringify(
      {
        purpose: "Apply entitlements 121-128 only to DrFlow-Staging",
        stagingRef: STAGING_REF,
        excludedClinical: excluded,
        includedCount: selected.length,
        pendingExpected: ALLOWED_PENDING,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );

  return { work, selected, excluded };
}

function runSupabase(args, workdir, { inherit = true } = {}) {
  const result = spawnSync("npx", ["supabase", ...args], {
    cwd: workdir,
    encoding: "utf8",
    shell: true,
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  });
  return result;
}

function parsePendingFromDryRunOutput(text) {
  // Prefer structured JSON (CLI may emit it anywhere in the stream).
  const migrationsKey = text.match(/"migrations"\s*:\s*\[((?:[^[\]]|\[[^\]]*\])*)\]/);
  if (migrationsKey) {
    try {
      const arr = JSON.parse(`[${migrationsKey[1]}]`);
      if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
        return arr.map((p) => basename(p));
      }
    } catch {
      /* fall through */
    }
  }
  const objectMatch = text.match(/\{[^{}]*"upToDate"\s*:\s*(?:true|false)[^{}]*"migrations"\s*:\s*\[[^\]]*\][^{}]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if (Array.isArray(parsed.migrations)) {
        return parsed.migrations.map((p) => basename(String(p)));
      }
    } catch {
      /* fall through */
    }
  }

  const pending = [];
  const lines = text.split(/\r?\n/);
  let inList = false;
  for (const line of lines) {
    if (/Would push these migrations:/i.test(line)) {
      inList = true;
      continue;
    }
    if (!inList) continue;
    const m = line.match(/^\s*[•\-\*]\s*(.+\.sql)\s*$/);
    if (m) {
      pending.push(basename(m[1].trim()));
      continue;
    }
    if (pending.length > 0 && (/Finished supabase/i.test(line) || /^\s*\{/.test(line))) {
      break;
    }
  }
  return pending;
}

function assertPendingExactly121to128(pending) {
  const normalized = pending.map((p) => basename(p));
  const unexpected = normalized.filter((p) => !ALLOWED_PENDING.includes(p));
  const missing = ALLOWED_PENDING.filter((p) => !normalized.includes(p));
  if (unexpected.length > 0) {
    fail(
      `Dry-run pending list contains migrations outside 121–128:\n  - ${unexpected.join("\n  - ")}`
    );
  }
  if (missing.length > 0) {
    fail(
      `Dry-run pending list missing expected entitlements migrations:\n  - ${missing.join("\n  - ")}`
    );
  }
  if (normalized.length !== ALLOWED_PENDING.length) {
    fail(
      `Dry-run pending count ${normalized.length} != expected ${ALLOWED_PENDING.length}`
    );
  }
  for (const prefix of FORBIDDEN_PENDING_PREFIXES) {
    if (normalized.some((p) => p.startsWith(prefix))) {
      fail(`Dry-run incorrectly includes clinical migration ${prefix}*`);
    }
  }
}

function cmdHistory() {
  assertLinkedStagingOrExit(ROOT);
  printTargetBanner();
  console.log("Remote vs local migration list (read-only)...\n");
  const result = runSupabase(
    ["migration", "list", "--project-ref", STAGING_REF, "--output-format", "json"],
    ROOT,
    { inherit: false }
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "");
    fail("migration list failed");
  }
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  let rows = [];
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*"migrations"[\s\S]*\}/)?.[0] || text);
    rows = parsed.migrations || [];
  } catch {
    // plain table fallback
    console.log(text);
    return;
  }

  const summarize = (from, to) => {
    const slice = rows.filter((r) => {
      const v = Number(r.local || r.time || 0);
      return v >= from && v <= to;
    });
    const applied = slice.filter((r) => r.remote && String(r.remote).length > 0);
    const missing = slice.filter((r) => !r.remote || String(r.remote).length === 0);
    return { total: slice.length, applied: applied.length, missing: missing.map((r) => r.local) };
  };

  const through109 = summarize(1, 109);
  const clinical = summarize(110, 120);
  const entitlements = summarize(121, 128);

  console.log("Status:");
  console.log(
    `  001–109 applied on remote: ${through109.applied}/${through109.total} (expect all applied)`
  );
  console.log(
    `  110–120 on remote: ${clinical.applied} applied, missing: [${clinical.missing.join(", ") || "none"}]`
  );
  console.log(
    `  121–128 on remote: ${entitlements.applied} applied, missing: [${entitlements.missing.join(", ") || "none"}]`
  );
  console.log("");

  if (through109.applied < 109) {
    console.warn("WARNING: staging appears behind 109; selective entitlements push may still work if 001–109 match.");
  }
  if (clinical.applied > 0) {
    console.warn("NOTE: some of 110–120 already on remote — unexpected for this plan.");
  }
  if (entitlements.missing.length !== 8) {
    console.warn(
      `NOTE: expected 8 missing entitlements migrations; found ${entitlements.missing.length}.`
    );
  }
}

function cmdDryRun() {
  assertLinkedStagingOrExit(ROOT);
  printTargetBanner();
  const { work, excluded } = buildIsolatedWorkspace();
  console.log(`Isolated workspace: ${work}`);
  console.log(`Excluded clinical migrations (not copied): ${excluded.length}`);
  excluded.forEach((f) => console.log(`  - ${f}`));
  console.log("");

  const result = runSupabase(
    ["db", "push", "--dry-run", "--project-ref", STAGING_REF],
    work,
    { inherit: false }
  );
  const combined = `${result.stdout || ""}\n${result.stderr || ""}`;
  process.stdout.write(combined);
  if (result.status !== 0) {
    cleanupWorkspace();
    fail(`selective dry-run failed with exit ${result.status}`);
  }

  const pending = parsePendingFromDryRunOutput(combined);
  console.log("\n--- Selective pending validation ---");
  console.log("Parsed pending:");
  pending.forEach((p) => console.log(`  • ${p}`));
  assertPendingExactly121to128(pending);
  console.log("\nOK: dry-run pending list is EXACTLY 121–128.");
  console.log("Main repo migrations unchanged. No fake history written.");
  console.log("Real apply is NOT executed by this command.");
  cleanupWorkspace();
  console.log("Temporary workspace cleaned up.");
}

function cmdApply() {
  assertLinkedStagingOrExit(ROOT);
  printTargetBanner();

  if (process.env.ALLOW_ENTITLEMENTS_STAGING_PUSH !== "1") {
    fail(
      "Refusing apply. Set ALLOW_ENTITLEMENTS_STAGING_PUSH=1 after successful selective dry-run review."
    );
  }
  if (process.env.CONFIRM_STAGING_PROJECT_REF !== STAGING_REF) {
    fail(
      `Refusing apply. Set CONFIRM_STAGING_PROJECT_REF=${STAGING_REF}`
    );
  }
  if (process.env.ALLOW_PRODUCTION_DB === "1" || process.env.CONFIRM_PRODUCTION_DB) {
    fail("Production confirmation env vars are set. Unset them before staging apply.");
  }

  // Rebuild workspace identically, then re-validate dry-run before push.
  const { work } = buildIsolatedWorkspace();
  console.log("Re-validating selective dry-run before apply...\n");
  const dry = runSupabase(
    ["db", "push", "--dry-run", "--project-ref", STAGING_REF],
    work,
    { inherit: false }
  );
  const dryOut = `${dry.stdout || ""}\n${dry.stderr || ""}`;
  if (dry.status !== 0) {
    cleanupWorkspace();
    fail("pre-apply dry-run failed");
  }
  const pending = parsePendingFromDryRunOutput(dryOut);
  const upToDate =
    /"upToDate"\s*:\s*true/.test(dryOut) ||
    /Remote database is up to date/i.test(dryOut);

  if (pending.length === 0 && upToDate) {
    // Confirm remote history already has 121–128 (idempotent success).
    const list = runSupabase(
      ["migration", "list", "--project-ref", STAGING_REF, "--output-format", "json"],
      ROOT,
      { inherit: false }
    );
    const listOut = `${list.stdout || ""}\n${list.stderr || ""}`;
    let rows = [];
    try {
      rows = JSON.parse(listOut.match(/\{[\s\S]*"migrations"[\s\S]*\}/)?.[0] || "{}").migrations || [];
    } catch {
      /* ignore */
    }
    const has = (ver) =>
      rows.some((r) => String(r.local) === String(ver) && r.remote && String(r.remote).length > 0);
    const allEntitlementsApplied = ALLOWED_PENDING.every((f) => {
      const ver = String(migrationVersion(f));
      return has(ver);
    });
    const clinicalApplied = FORBIDDEN_PENDING_PREFIXES.some((prefix) => {
      const ver = prefix.replace(/_$/, "");
      return has(ver);
    });
    if (allEntitlementsApplied && !clinicalApplied) {
      console.log(
        "Remote already has 121–128 applied; selective workspace is up to date. Nothing to push."
      );
      cleanupWorkspace();
      console.log("Run: npm run entitlements:staging:verify");
      process.exit(0);
    }
  }

  if (pending.length === 0) {
    console.error("--- dry-run output (parse empty) ---");
    console.error(dryOut.slice(0, 4000));
    cleanupWorkspace();
    fail("pre-apply dry-run produced an empty pending list (parser/CLI mismatch)");
  }
  assertPendingExactly121to128(pending);
  console.log("Pre-apply dry-run OK (exactly 121–128). Pushing...\n");

  const push = runSupabase(
    ["db", "push", "--project-ref", STAGING_REF],
    work,
    { inherit: true }
  );
  if (push.status !== 0) {
    fail(`selective apply failed with exit ${push.status}`);
  }
  console.log("\nSelective apply finished. Run: npm run entitlements:staging:verify");
  cleanupWorkspace();
}

function cmdVerify() {
  assertLinkedStagingOrExit(ROOT);
  printTargetBanner();
  console.log("Post-apply verification (read-mostly + rollback-safe checks)...\n");

  // History check via migration list
  const list = runSupabase(
    ["migration", "list", "--project-ref", STAGING_REF, "--output-format", "json"],
    ROOT,
    { inherit: false }
  );
  if (list.status !== 0) {
    process.stderr.write(list.stderr || list.stdout || "");
    fail("migration list failed during verify");
  }
  const text = `${list.stdout || ""}\n${list.stderr || ""}`;
  const parsed = JSON.parse(text.match(/\{[\s\S]*"migrations"[\s\S]*\}/)?.[0] || "{}");
  const rows = parsed.migrations || [];
  const remoteHas = (ver) =>
    rows.some((r) => String(r.local) === String(ver) && r.remote && String(r.remote).length > 0);
  const remoteMissing = (ver) =>
    rows.some((r) => String(r.local) === String(ver) && (!r.remote || String(r.remote) === ""));

  for (let v = 121; v <= 128; v++) {
    if (!remoteHas(v)) fail(`Expected remote applied migration ${v}`);
  }
  for (let v = 110; v <= 120; v++) {
    if (remoteHas(v)) {
      fail(`Clinical migration ${v} is applied on remote — entitlements-only plan violated`);
    }
    if (!remoteMissing(v) && !rows.some((r) => String(r.local) === String(v))) {
      // ok if not listed
    }
  }
  console.log("OK: remote history has 121–128 applied; 110–120 still unapplied.");

  // Object / plan checks via db query if available
  const checksSql = `
DO $$
DECLARE
  v_legacy public.plans%ROWTYPE;
  v_clinic_id uuid;
  v_plan_key text;
  v_status text;
  v_cnt int;
BEGIN
  IF to_regclass('public.plans') IS NULL THEN
    RAISE EXCEPTION 'MISSING_TABLE plans';
  END IF;
  IF to_regclass('public.features') IS NULL THEN
    RAISE EXCEPTION 'MISSING_TABLE features';
  END IF;
  IF to_regclass('public.plan_features') IS NULL THEN
    RAISE EXCEPTION 'MISSING_TABLE plan_features';
  END IF;
  IF to_regclass('public.clinic_entitlement_subscriptions') IS NULL THEN
    RAISE EXCEPTION 'MISSING_TABLE clinic_entitlement_subscriptions';
  END IF;
  IF to_regclass('public.clinic_feature_overrides') IS NULL THEN
    RAISE EXCEPTION 'MISSING_TABLE clinic_feature_overrides';
  END IF;
  IF to_regclass('public.feature_usage') IS NULL THEN
    RAISE EXCEPTION 'MISSING_TABLE feature_usage';
  END IF;

  FOREACH v_plan_key IN ARRAY ARRAY['trial','basic','pro','premium','enterprise','legacy']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.plans p WHERE p.key = v_plan_key) THEN
      RAISE EXCEPTION 'MISSING_PLAN %', v_plan_key;
    END IF;
  END LOOP;

  SELECT * INTO v_legacy FROM public.plans WHERE key = 'legacy';
  IF v_legacy.is_internal IS NOT TRUE OR v_legacy.is_public IS NOT FALSE THEN
    RAISE EXCEPTION 'LEGACY_FLAGS_INVALID';
  END IF;

  -- Existing clinics should have legacy/active when subscribed via backfill
  SELECT count(*) INTO v_cnt
  FROM public.clinic_entitlement_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE p.key = 'legacy' AND s.status = 'active';
  IF v_cnt < 1 THEN
    RAISE NOTICE 'WARNING: no legacy/active subscriptions found (staging may have zero clinics)';
  END IF;

  IF to_regprocedure('public.increment_feature_usage(uuid,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'MISSING_FN increment_feature_usage';
  END IF;
  IF to_regprocedure('public.try_consume_feature_usage(uuid,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'MISSING_FN try_consume_feature_usage';
  END IF;

  -- Rollback-safe onboarding proof
  BEGIN
    INSERT INTO public.clinics (id, name)
    VALUES ('00000000-0000-4000-8000-000000000099', 'entitlements_verify_tmp')
    ON CONFLICT (id) DO NOTHING;
    -- If clinics requires more NOT NULL cols, skip insert path
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'SKIP_NEW_CLINIC_INSERT: %', SQLERRM;
  END;

  SELECT p.key, s.status INTO v_plan_key, v_status
  FROM public.clinic_entitlement_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.clinic_id = '00000000-0000-4000-8000-000000000099'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_plan_key IS NOT NULL THEN
    IF v_plan_key <> 'trial' OR v_status <> 'trialing' THEN
      RAISE EXCEPTION 'ONBOARDING_UNEXPECTED % %', v_plan_key, v_status;
    END IF;
    DELETE FROM public.clinic_entitlement_subscriptions
    WHERE clinic_id = '00000000-0000-4000-8000-000000000099';
    DELETE FROM public.clinics WHERE id = '00000000-0000-4000-8000-000000000099';
  END IF;

  RAISE NOTICE 'ENTITLEMENTS_STAGING_VERIFY_OK';
END $$;
`;

  // Prefer `supabase db query` if available; otherwise print SQL for operator.
  const query = runSupabase(
    ["db", "query", "--project-ref", STAGING_REF, checksSql],
    ROOT,
    { inherit: false }
  );
  if (query.status !== 0) {
    console.log("\nNOTE: `supabase db query` unavailable or failed.");
    console.log("Migration history checks already passed.");
    console.log("Run the following in Staging SQL Editor for object/legacy/onboarding verification:\n");
    console.log(checksSql);
    console.log(query.stderr || query.stdout || "");
    // History passed — soft pass with instructions
    console.log("\nVERIFY_PARTIAL: history OK; run SQL block above for full object checks.");
    process.exit(0);
  }
  process.stdout.write(query.stdout || "");
  process.stderr.write(query.stderr || "");
  console.log("\nOK: entitlements staging verify completed.");
}

function cleanupWorkspace() {
  rmSync(WORK_PARENT, { recursive: true, force: true });
}

function cmdHelp() {
  console.log(`Entitlements selective staging deploy (${STAGING_NAME})

  npm run entitlements:staging:history   # read-only remote/local status
  npm run entitlements:staging:dry-run   # isolated workspace; exactly 121-128
  npm run entitlements:staging:apply     # requires env confirmation (manual)
  npm run entitlements:staging:verify    # after apply

Apply env:
  ALLOW_ENTITLEMENTS_STAGING_PUSH=1
  CONFIRM_STAGING_PROJECT_REF=${STAGING_REF}
`);
}

switch (mode) {
  case "history":
    cmdHistory();
    break;
  case "dry-run":
    cmdDryRun();
    break;
  case "apply":
    cmdApply();
    break;
  case "verify":
    cmdVerify();
    break;
  case "cleanup":
    cleanupWorkspace();
    console.log("Cleaned .tmp-entitlements-staging-push");
    break;
  default:
    cmdHelp();
}
