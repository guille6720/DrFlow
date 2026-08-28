#!/usr/bin/env node
/**
 * Phase 5 — explicit PITR verification via Supabase Management API (CLI).
 * Does NOT infer PITR from wal_level or archive_mode.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { STAGING_REF } from "../supabase-project-refs.mjs";

const OUT = resolve(process.cwd(), "coverage/phase5-pitr-evidence.json");

function listBackupsViaApi() {
  const result = spawnSync(
    "npx",
    ["supabase", "backups", "list", "--project-ref", STAGING_REF, "--output-format", "json"],
    { encoding: "utf8", shell: true }
  );
  const text = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error(`Management API backups list failed: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

function isoFromUnix(sec) {
  if (!sec || !Number.isFinite(sec)) return null;
  return new Date(sec * 1000).toISOString();
}

const api = listBackupsViaApi();
const pitrEnabled = api.pitr_enabled === true;
const physical = api.physical_backup_data ?? {};
const latestDaily = api.backups?.[0]?.inserted_at ?? null;
const earliestDaily = api.backups?.[api.backups.length - 1]?.inserted_at ?? null;

const report = {
  generatedAt: new Date().toISOString(),
  environment: "staging",
  projectRef: STAGING_REF,
  sourceOfEvidence: "Supabase Management API via `supabase backups list --output-format json`",
  pitr: {
    enabled: pitrEnabled,
    earliestRecoveryPoint: pitrEnabled
      ? isoFromUnix(physical.earliest_physical_backup_date_unix)
      : null,
    latestRecoveryPoint: pitrEnabled
      ? isoFromUnix(physical.latest_physical_backup_date_unix)
      : null,
    retentionWindow: pitrEnabled ? "See dashboard PITR addon (pitr_7/14/28)" : null,
    walgEnabled: api.walg_enabled === true,
    region: api.region ?? null,
  },
  dailyPhysicalBackups: {
    count: api.backups?.length ?? 0,
    latestCompletedAt: latestDaily,
    earliestListedAt: earliestDaily,
    impliedRpoWithoutPitrHours: latestDaily
      ? Math.round(((Date.now() - new Date(latestDaily).getTime()) / 3_600_000) * 100) / 100
      : null,
  },
  effectiveRpo: {
    measured: false,
    reason: pitrEnabled
      ? "PITR enabled — run phase5:dr:measure-rpo after synthetic transaction"
      : "PITR disabled — cannot measure sub-hour RPO",
    pass: false,
  },
  manualInfraActionRequired: !pitrEnabled,
  manualSteps: !pitrEnabled
    ? [
        "MANUAL INFRA ACTION REQUIRED",
        "Supabase Dashboard → DrFlow-Staging (gprmsufvhabntbrytwyi)",
        "Database → Backups → Point-in-Time Recovery",
        "Enable PITR add-on (Pro/Team plan; pitr_7 minimum)",
        "Wait until earliest/latest recovery points appear in dashboard",
        "Re-run: npm run phase5:dr:verify-pitr",
      ]
    : [],
  isolatedRestore: {
    performed: false,
    blockedReason: pitrEnabled ? null : "PITR not enabled — restore-pitr API unavailable",
  },
};

mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("\n🔎 Phase 5 — PITR verification (Management API)\n");
console.log(`   Project:     ${STAGING_REF.slice(0, 4)}…${STAGING_REF.slice(-4)}`);
console.log(`   PITR enabled: ${pitrEnabled}`);
if (pitrEnabled) {
  console.log(`   Earliest RP:  ${report.pitr.earliestRecoveryPoint ?? "unknown"}`);
  console.log(`   Latest RP:    ${report.pitr.latestRecoveryPoint ?? "unknown"}`);
} else {
  console.log("\n   ⛔ MANUAL INFRA ACTION REQUIRED");
  console.log("   Enable PITR in Supabase Dashboard before isolated restore drill.\n");
  for (const step of report.manualSteps.slice(1)) {
    console.log(`   • ${step}`);
  }
}
console.log(`\n→ ${OUT}\n`);

process.exit(pitrEnabled ? 0 : 2);
