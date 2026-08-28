#!/usr/bin/env node
/**
 * Phase 5 — read-only audit of staging backup / PITR capabilities.
 * Never prints secrets or connection strings.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadEnv } from "../_env.mjs";
import { stagingDbQuery } from "../lib/staging-db-query.mjs";
import { PRODUCTION_REF, readLinkedProjectRef,STAGING_REF } from "../supabase-project-refs.mjs";

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

function probeWalSettings() {
  try {
    const result = stagingDbQuery(`
SELECT name, setting
FROM pg_settings
WHERE name IN ('wal_level', 'archive_mode', 'max_wal_senders', 'track_commit_timestamp')
ORDER BY name;
`);
    const rows = result.rows ?? result.result ?? [];
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, error: String(err.message ?? err).slice(0, 500) };
  }
}

function inferPitrFromWal(rows) {
  const map = Object.fromEntries((rows ?? []).map((r) => [r.name, r.setting]));
  const walLevel = map.wal_level ?? "unknown";
  const archiveMode = map.archive_mode ?? "unknown";
  return {
    walLevel,
    archiveMode,
    /** Supabase PITR is a platform feature; WAL alone does not prove PITR billing. */
    pitrLikelyPlatformManaged: walLevel === "logical" || archiveMode === "on",
    pitrConfirmed: false,
    note:
      "Confirm PITR in Supabase Dashboard → Project → Database → Backups. CLI/pg_settings cannot prove paid PITR retention.",
  };
}

async function main() {
  const linked = readLinkedProjectRef();
  const env = loadEnv({ required: false });
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL || env.DATABASE_URL || env.SUPABASE_DB_URL);
  const wal = probeWalSettings();
  const pitr = inferPitrFromWal(wal.rows);

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
      status: pitr.pitrConfirmed ? "enabled_verified" : "not_verified_in_dashboard",
      ...pitr,
      manualVerificationSteps: [
        "Supabase Dashboard → DrFlow-Staging (gprmsufvhabntbrytwyi) → Database → Backups",
        "Confirm whether 'Point in Time Recovery' toggle is ON",
        "Record retention window (e.g. 7 days) and latest recoverable timestamp",
        "If OFF: actual RPO is daily-backup bound (~24 h), failing RPO <= 1 h target",
      ],
    },
    walProbe: wal,
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
  console.log(`   PITR:        ${report.pitr.status}`);
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
