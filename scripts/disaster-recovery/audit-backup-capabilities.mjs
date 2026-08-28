#!/usr/bin/env node
/**
 * Phase 5 — read-only audit of staging backup / PITR capabilities.
 * Never prints secrets or connection strings.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { loadEnv } from "../_env.mjs";
import { PRODUCTION_REF, readLinkedProjectRef, STAGING_REF } from "../supabase-project-refs.mjs";

const OUT_DIR = resolve(process.cwd(), "coverage");
const OUT_FILE = resolve(OUT_DIR, "phase5-backup-audit.json");

function redactRef(ref) {
  if (!ref || ref.length < 8) return "[unknown]";
  return `${ref.slice(0, 4)}…${ref.slice(-4)}`;
}

function scanLocalBackups() {
  const dir = resolve(process.cwd(), "backups");
  if (!existsSync(dir)) {
    return { present: false, count: 0, newest: null, oldest: null };
  }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => {
      const full = resolve(dir, f);
      const st = statSync(full);
      return { name: f, mtime: st.mtime.toISOString(), sizeBytes: st.size };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
  return {
    present: files.length > 0,
    count: files.length,
    newest: files[0] ?? null,
    oldest: files[files.length - 1] ?? null,
  };
}

function fetchManagementBackups() {
  const result = spawnSync(
    "npx",
    ["supabase", "backups", "list", "--project-ref", STAGING_REF, "--output-format", "json"],
    { encoding: "utf8", shell: true }
  );
  const text = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { ok: false, error: text.slice(0, 400) };
  }
  return { ok: true, data: JSON.parse(text.slice(start, end + 1)) };
}

async function main() {
  const linked = readLinkedProjectRef();
  const env = loadEnv({ required: false });
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL || env.DATABASE_URL || env.SUPABASE_DB_URL);
  const mgmt = fetchManagementBackups();
  const api = mgmt.ok ? mgmt.data : null;
  const pitrEnabled = api?.pitr_enabled === true;

  const report = {
    generatedAt: new Date().toISOString(),
    environment: "staging",
    projectRef: STAGING_REF,
    linkedProjectRef: linked,
    productionRefBlocked: linked === PRODUCTION_REF,
    backupInventory: {
      supabaseManagedDaily: {
        mechanism: "Supabase Dashboard → Database → Backups (platform-managed)",
        frequency: "Daily (platform default; exact schedule operator-verified in dashboard)",
        retention: "Plan-dependent (typically 7 days on Pro; verify in dashboard)",
        restoreMechanism: "Dashboard restore to new project or PITR timestamp (if enabled)",
        prerequisites: ["Supabase org access", "Billing owner", "Never overwrite active staging in-place"],
        limitations: ["Without PITR, RPO ≈ 24 h between daily snapshots", "Restore is operator-initiated, not automated in repo"],
      },
      logicalPgDump: {
        script: "scripts/backup-supabase.mjs",
        available: hasDatabaseUrl,
        note: hasDatabaseUrl
          ? "Manual on-demand; not scheduled in CI"
          : "DATABASE_URL not configured locally — use dashboard or configure URI in .env.local",
        localFiles: scanLocalBackups(),
      },
      vercelRollback: {
        mechanism: "Vercel deployment promote / instant rollback",
        rtoEstimate: "Minutes for app-only incidents (not measured as full DR RTO)",
        prerequisites: ["Vercel project access", "Known-good deployment ID"],
      },
      gitRecovery: {
        mechanism: "Git tags + release branches; migration history in supabase/migrations",
        script: "npm run phase6:migration-history:staging",
      },
      auditLogPreservation: {
        table: "audit_logs",
        note: "Restored with Postgres backup; verify post-restore with validate-recovery-integrity.mjs",
      },
    },
    pitr: {
      status: pitrEnabled ? "enabled_verified" : "disabled_verified_management_api",
      enabled: pitrEnabled,
      sourceOfEvidence: "Supabase Management API (`supabase backups list`)",
      earliestRecoveryPoint: pitrEnabled && api?.physical_backup_data?.earliest_physical_backup_date_unix
        ? new Date(api.physical_backup_data.earliest_physical_backup_date_unix * 1000).toISOString()
        : null,
      latestRecoveryPoint: pitrEnabled && api?.physical_backup_data?.latest_physical_backup_date_unix
        ? new Date(api.physical_backup_data.latest_physical_backup_date_unix * 1000).toISOString()
        : null,
      dailyBackupsListed: api?.backups?.length ?? 0,
      manualVerificationSteps: pitrEnabled
        ? ["Record retention window from dashboard PITR settings"]
        : [
            "MANUAL INFRA ACTION REQUIRED",
            "Supabase Dashboard → DrFlow-Staging → Database → Backups → Enable PITR",
          ],
    },
    managementApiProbe: mgmt.ok ? { ok: true } : { ok: false, error: mgmt.error },
    rpoTargetHours: 1,
    rtoTargetHours: 2,
    stagingOnly: true,
    productionTouched: false,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("\n📋 Phase 5 — Backup capability audit (staging)\n");
  console.log(`   Project ref: ${redactRef(STAGING_REF)}`);
  console.log(`   Linked ref:  ${linked ? redactRef(linked) : "(not linked)"}`);
  console.log(`   PITR:        ${pitrEnabled ? "enabled (Management API)" : "disabled (Management API)"}`);
  console.log(`   pg_dump:     ${hasDatabaseUrl ? "DATABASE_URL configured" : "not configured locally"}`);
  console.log(`   Local dumps: ${report.backupInventory.logicalPgDump.localFiles.count} file(s)`);
  console.log(`\n→ ${OUT_FILE}\n`);

  if (linked === PRODUCTION_REF) {
    console.error("❌ Linked to production — aborting further DR actions\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
});
