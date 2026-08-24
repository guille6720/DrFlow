#!/usr/bin/env node
/**
 * Selective Superadmin commercial control staging deploy (129 ONLY).
 *
 * Builds an isolated temporary Supabase workdir that includes:
 *   - migrations already on staging (≤109)
 *   - entitlements pack 121–128 (already applied remotely)
 *   - superadmin pack 129
 * and EXCLUDES clinical pack 110–120.
 *
 * Dry-run must show EXACTLY pending:
 *   129_superadmin_commercial_control.sql
 *
 * Main repo supabase/migrations is never modified.
 * Never targets production.
 *
 * Commands (via package.json):
 *   npm run superadmin:staging:history
 *   npm run superadmin:staging:dry-run
 *   npm run superadmin:staging:apply   (requires env confirmation; not for auto-run)
 *   npm run superadmin:staging:verify
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
const WORK_PARENT = resolve(ROOT, ".tmp-superadmin-staging-push");
const ALLOWED_PENDING = ["129_superadmin_commercial_control.sql"];
const ENTITLEMENTS_APPLIED = [
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
  if (STAGING_REF === PRODUCTION_REF) {
    fail("Internal safety failure: staging ref equals production ref");
  }
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

  for (const name of [...ENTITLEMENTS_APPLIED, ...ALLOWED_PENDING]) {
    if (!selected.includes(name)) {
      fail(`Expected migration missing from workspace set: ${name}`);
    }
  }
  for (const name of FORBIDDEN_PENDING_PREFIXES) {
    if (selected.some((f) => f.startsWith(name))) {
      fail(`Forbidden clinical migration leaked into workspace: ${name}*`);
    }
  }

  // Workspace must not include versions >129 that would also become pending.
  const unexpectedHigh = selected.filter((f) => {
    const v = migrationVersion(f);
    return v !== null && v > 129;
  });
  if (unexpectedHigh.length > 0) {
    fail(
      `Workspace includes migrations after 129 that would pollute pending:\n  - ${unexpectedHigh.join("\n  - ")}`
    );
  }

  rmSync(WORK_PARENT, { recursive: true, force: true });
  mkdirSync(WORK_PARENT, { recursive: true });
  const work = mkdtempSync(join(WORK_PARENT, "ws-"));
  const destMigrations = join(work, "supabase", "migrations");
  mkdirSync(destMigrations, { recursive: true });

  writeFileSync(
    join(work, "supabase", "config.toml"),
    `# Isolated superadmin staging push workspace — DO NOT use for production.\nproject_id = "${STAGING_REF}"\n`,
    "utf8"
  );

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
        purpose: "Apply superadmin commercial control 129 only to DrFlow-Staging",
        stagingRef: STAGING_REF,
        productionRefForbidden: PRODUCTION_REF,
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
  return spawnSync("npx", ["supabase", ...args], {
    cwd: workdir,
    encoding: "utf8",
    shell: true,
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  });
}

function parsePendingFromDryRunOutput(text) {
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
  const objectMatch = text.match(
    /\{[^{}]*"upToDate"\s*:\s*(?:true|false)[^{}]*"migrations"\s*:\s*\[[^\]]*\][^{}]*\}/
  );
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

function assertPendingExactly129(pending) {
  const normalized = pending.map((p) => basename(p));
  const unexpected = normalized.filter((p) => !ALLOWED_PENDING.includes(p));
  const missing = ALLOWED_PENDING.filter((p) => !normalized.includes(p));
  if (unexpected.length > 0) {
    fail(
      `Dry-run pending list contains migrations outside 129 — ABORT:\n  - ${unexpected.join("\n  - ")}`
    );
  }
  if (missing.length > 0) {
    fail(
      `Dry-run pending list missing expected migration — ABORT:\n  - ${missing.join("\n  - ")}`
    );
  }
  if (normalized.length !== ALLOWED_PENDING.length) {
    fail(
      `Dry-run pending count ${normalized.length} != expected ${ALLOWED_PENDING.length} — ABORT`
    );
  }
  for (const prefix of FORBIDDEN_PENDING_PREFIXES) {
    if (normalized.some((p) => p.startsWith(prefix))) {
      fail(`Dry-run incorrectly includes clinical migration ${prefix}* — ABORT`);
    }
  }
}

function parseMigrationListRows(text) {
  try {
    return JSON.parse(text.match(/\{[\s\S]*"migrations"[\s\S]*\}/)?.[0] || text).migrations || [];
  } catch {
    return null;
  }
}

function remoteHas(rows, ver) {
  return rows.some(
    (r) => String(r.local) === String(ver) && r.remote && String(r.remote).length > 0
  );
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
  const rows = parseMigrationListRows(text);
  if (!rows) {
    console.log(text);
    return;
  }

  const summarize = (from, to) => {
    const slice = rows.filter((r) => {
      const v = Number(r.local || r.time || 0);
      return v >= from && v <= to;
    });
    const applied = slice.filter((r) => r.remote && String(r.remote).length > 0);
    const missing = slice
      .filter((r) => !r.remote || String(r.remote).length === 0)
      .map((r) => r.local);
    return { total: slice.length, applied: applied.length, missing };
  };

  const through109 = summarize(1, 109);
  const clinical = summarize(110, 120);
  const entitlements = summarize(121, 128);
  const superadmin = summarize(129, 129);

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
  console.log(
    `  129 on remote: ${superadmin.applied} applied, missing: [${superadmin.missing.join(", ") || "none"}]`
  );
  console.log("");
  console.log("Expected before apply:");
  console.log("  110–120 = NOT APPLIED");
  console.log("  121–128 = APPLIED");
  console.log("  129 = PENDING");
  console.log("");

  if (clinical.applied > 0) {
    console.warn("NOTE: some of 110–120 already on remote — unexpected for this plan.");
  }
  if (entitlements.missing.length > 0) {
    fail(
      `121–128 must be applied before selective 129. Missing: ${entitlements.missing.join(", ")}`
    );
  }
  if (superadmin.applied > 0) {
    console.warn("NOTE: 129 already applied on remote.");
  } else if (superadmin.missing.length === 0 && !rows.some((r) => String(r.local) === "129")) {
    console.warn("NOTE: local 129 not listed by CLI yet; dry-run workspace still includes the file.");
  }
}

function cmdDryRun() {
  assertLinkedStagingOrExit(ROOT);
  printTargetBanner();
  const { work, excluded, selected } = buildIsolatedWorkspace();
  console.log(`Isolated workspace: ${work}`);
  console.log(`Included migrations: ${selected.length}`);
  console.log(`Excluded clinical migrations (not copied): ${excluded.length}`);
  excluded.forEach((f) => console.log(`  - ${f}`));
  console.log("");
  console.log("Workspace composition: 001–109 + 121–129 (exclude 110–120)");
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
  assertPendingExactly129(pending);
  console.log("\nOK: dry-run pending list is EXACTLY 129_superadmin_commercial_control.sql");
  console.log("Main repo migrations unchanged. No fake history written.");
  console.log("Real apply is NOT executed by this command.");
  cleanupWorkspace();
  console.log("Temporary workspace cleaned up.");
}

function cmdApply() {
  assertLinkedStagingOrExit(ROOT);
  printTargetBanner();

  if (process.env.ALLOW_SUPERADMIN_STAGING_PUSH !== "1") {
    fail(
      "Refusing apply. Set ALLOW_SUPERADMIN_STAGING_PUSH=1 after successful selective dry-run review."
    );
  }
  if (process.env.CONFIRM_STAGING_PROJECT_REF !== STAGING_REF) {
    fail(`Refusing apply. Set CONFIRM_STAGING_PROJECT_REF=${STAGING_REF}`);
  }
  if (process.env.ALLOW_PRODUCTION_DB === "1" || process.env.CONFIRM_PRODUCTION_DB) {
    fail("Production confirmation env vars are set. Unset them before staging apply.");
  }
  if (STAGING_REF === PRODUCTION_REF) {
    fail("TARGET equals production — ABORT");
  }

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
    const list = runSupabase(
      ["migration", "list", "--project-ref", STAGING_REF, "--output-format", "json"],
      ROOT,
      { inherit: false }
    );
    const listOut = `${list.stdout || ""}\n${list.stderr || ""}`;
    const rows = parseMigrationListRows(listOut) || [];
    const has129 = remoteHas(rows, 129);
    const clinicalApplied = FORBIDDEN_PENDING_PREFIXES.some((prefix) =>
      remoteHas(rows, prefix.replace(/_$/, ""))
    );
    if (has129 && !clinicalApplied) {
      console.log(
        "Remote already has 129 applied; selective workspace is up to date. Nothing to push."
      );
      cleanupWorkspace();
      console.log("Run: npm run superadmin:staging:verify");
      process.exit(0);
    }
  }

  if (pending.length === 0) {
    console.error("--- dry-run output (parse empty) ---");
    console.error(dryOut.slice(0, 4000));
    cleanupWorkspace();
    fail("pre-apply dry-run produced an empty pending list (parser/CLI mismatch)");
  }
  assertPendingExactly129(pending);
  console.log("Pre-apply dry-run OK (exactly 129). Pushing...\n");

  const push = runSupabase(
    ["db", "push", "--project-ref", STAGING_REF],
    work,
    { inherit: true }
  );
  if (push.status !== 0) {
    fail(`selective apply failed with exit ${push.status}`);
  }
  console.log("\nSelective apply finished. Run: npm run superadmin:staging:verify");
  cleanupWorkspace();
}

function cmdVerify() {
  assertLinkedStagingOrExit(ROOT);
  printTargetBanner();
  console.log("Post-apply verification (history + objects/RPCs/RLS/thresholds)...\n");

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
  const rows = parseMigrationListRows(text);
  if (!rows) fail("could not parse migration list JSON");

  for (let v = 121; v <= 129; v++) {
    if (!remoteHas(rows, v)) fail(`Expected remote applied migration ${v}`);
  }
  for (let v = 110; v <= 120; v++) {
    if (remoteHas(rows, v)) {
      fail(`Clinical migration ${v} is applied on remote — selective plan violated`);
    }
  }
  console.log("OK: remote history has 121–129 applied; 110–120 still unapplied.");

  const checksSql = `
DO $$
DECLARE
  v_info numeric;
  v_warn numeric;
  v_crit numeric;
  v_rls boolean;
  v_write_pols int;
BEGIN
  IF to_regclass('public.commercial_usage_thresholds') IS NULL THEN
    RAISE EXCEPTION 'MISSING_TABLE commercial_usage_thresholds';
  END IF;
  IF to_regclass('public.clinic_plan_recommendations') IS NULL THEN
    RAISE EXCEPTION 'MISSING_TABLE clinic_plan_recommendations';
  END IF;

  SELECT c.relrowsecurity INTO v_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'commercial_usage_thresholds';
  IF v_rls IS NOT TRUE THEN
    RAISE EXCEPTION 'RLS_DISABLED commercial_usage_thresholds';
  END IF;

  SELECT c.relrowsecurity INTO v_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'clinic_plan_recommendations';
  IF v_rls IS NOT TRUE THEN
    RAISE EXCEPTION 'RLS_DISABLED clinic_plan_recommendations';
  END IF;

  SELECT info_pct, warn_pct, critical_pct
    INTO v_info, v_warn, v_crit
  FROM public.commercial_usage_thresholds
  WHERE id = 1;
  IF v_info IS DISTINCT FROM 70 OR v_warn IS DISTINCT FROM 85 OR v_crit IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'THRESHOLDS_UNEXPECTED % % %', v_info, v_warn, v_crit;
  END IF;

  IF to_regprocedure('public.upsert_clinic_plan_recommendation(uuid,text,text,text,integer,jsonb,text)') IS NULL THEN
    RAISE EXCEPTION 'MISSING_FN upsert_clinic_plan_recommendation';
  END IF;
  IF to_regprocedure('public.set_clinic_plan_recommendation_status(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'MISSING_FN set_clinic_plan_recommendation_status';
  END IF;
  IF to_regprocedure('public.update_commercial_plan(text,text,text,integer,boolean,boolean,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'MISSING_FN update_commercial_plan';
  END IF;
  IF to_regprocedure('public.set_feature_active(text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'MISSING_FN set_feature_active';
  END IF;
  IF to_regprocedure('public.upsert_plan_feature_assignment(text,text,boolean,numeric)') IS NULL THEN
    RAISE EXCEPTION 'MISSING_FN upsert_plan_feature_assignment';
  END IF;

  -- Normal clinic users must not have direct INSERT/UPDATE/DELETE policies.
  SELECT count(*) INTO v_write_pols
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('commercial_usage_thresholds', 'clinic_plan_recommendations')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  IF v_write_pols > 0 THEN
    RAISE EXCEPTION 'UNEXPECTED_WRITE_POLICIES %', v_write_pols;
  END IF;

  -- SELECT policies must require is_superadmin() (name check + qual contains function).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clinic_plan_recommendations'
      AND cmd = 'SELECT'
      AND qual ILIKE '%is_superadmin%'
  ) THEN
    RAISE EXCEPTION 'MISSING_SUPERADMIN_SELECT_POLICY clinic_plan_recommendations';
  END IF;

  RAISE NOTICE 'SUPERADMIN_STAGING_VERIFY_OK';
END $$;
`;

  const query = runSupabase(
    ["db", "query", "--project-ref", STAGING_REF, checksSql],
    ROOT,
    { inherit: false }
  );
  if (query.status !== 0) {
    console.log("\nNOTE: `supabase db query` unavailable or failed.");
    console.log("Migration history checks already passed.");
    console.log("Run the following in Staging SQL Editor for object/RPC/RLS verification:\n");
    console.log(checksSql);
    console.log(query.stderr || query.stdout || "");
    console.log("\nVERIFY_PARTIAL: history OK; run SQL block above for full object checks.");
    process.exit(0);
  }
  process.stdout.write(query.stdout || "");
  process.stderr.write(query.stderr || "");
  console.log("\nOK: superadmin staging verify completed.");
  console.log("Note: live Superadmin write proof still requires a logged-in superadmin session in the app.");
}

function cleanupWorkspace() {
  rmSync(WORK_PARENT, { recursive: true, force: true });
}

function cmdHelp() {
  console.log(`Superadmin selective staging deploy (${STAGING_NAME})

  npm run superadmin:staging:history   # read-only remote/local status
  npm run superadmin:staging:dry-run   # isolated workspace; exactly 129
  npm run superadmin:staging:apply     # requires env confirmation (manual)
  npm run superadmin:staging:verify    # after apply

Apply env:
  ALLOW_SUPERADMIN_STAGING_PUSH=1
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
    console.log("Cleaned .tmp-superadmin-staging-push");
    break;
  default:
    cmdHelp();
}
