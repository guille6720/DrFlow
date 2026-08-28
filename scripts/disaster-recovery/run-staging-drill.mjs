#!/usr/bin/env node
/**
 * Phase 5 — staging DR drill orchestrator (non-destructive when PITR restore unavailable).
 * Measures validation RTO; records RPO from backup audit (not estimated).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertLinkedStagingOrExit, STAGING_REF } from "../supabase-project-refs.mjs";

const COVERAGE = resolve(process.cwd(), "coverage");
const DRILL_REPORT = resolve(COVERAGE, "phase5-drill-report.json");

function runNode(script, args = [], extraEnv = {}) {
  const start = Date.now();
  const result = spawnSync("node", [script, ...args], {
    encoding: "utf8",
    shell: true,
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
  });
  return {
    script,
    exitCode: result.status ?? 1,
    durationMs: Date.now() - start,
    stdout: (result.stdout ?? "").slice(-2000),
    stderr: (result.stderr ?? "").slice(-2000),
  };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

assertLinkedStagingOrExit();

const drillStart = new Date();
const incidentTimestamp = drillStart.toISOString();
console.log("\n🚨 Phase 5 — Staging DR drill (synthetic, non-destructive)\n");
console.log(`   Incident declared: ${incidentTimestamp}`);
console.log(`   Target project:    ${STAGING_REF.slice(0, 4)}…${STAGING_REF.slice(-4)}`);
console.log("   Mode: validate current DB + backup audit (no in-place destructive restore)\n");

const recoveryStart = Date.now();
const steps = [];

steps.push(runNode("scripts/disaster-recovery/audit-backup-capabilities.mjs"));
steps.push(runNode("scripts/disaster-recovery/seed-recovery-fixture.mjs"));
steps.push(runNode("scripts/disaster-recovery/validate-recovery-integrity.mjs", [], {
  PHASE5_ALLOW_OFFLINE_HEALTH: "1",
}));
steps.push(runNode("scripts/disaster-recovery/storage-consistency-check.mjs"));

const validationEnd = Date.now();
const measuredRtoMs = validationEnd - recoveryStart;
const measuredRtoMinutes = Math.round((measuredRtoMs / 60_000) * 100) / 100;

const audit = readJson(resolve(COVERAGE, "phase5-backup-audit.json"));
const validation = readJson(resolve(COVERAGE, "phase5-recovery-validation.json"));

const pitrVerified = audit?.pitr?.status === "enabled_verified";
const latestRecoverable = audit?.pitr?.latestRecoverableTimestamp ?? null;

let actualRpoHours = null;
let rpoPass = false;
let rpoNote = "";

if (pitrVerified && latestRecoverable) {
  const lagMs = drillStart.getTime() - new Date(latestRecoverable).getTime();
  actualRpoHours = Math.round((lagMs / 3_600_000) * 1000) / 1000;
  rpoPass = actualRpoHours <= 1;
  rpoNote = "Measured from PITR latest recoverable timestamp";
} else {
  actualRpoHours = 24;
  rpoPass = false;
  rpoNote =
    "PITR not verified in dashboard — daily managed backup bound (~24 h). Cannot claim RPO <= 1 h.";
}

const rtoPass = measuredRtoMinutes <= 120;
const integrityPass = validation?.allPass === true;
const allStepsPass = steps.every((s) => s.exitCode === 0);

const report = {
  generatedAt: new Date().toISOString(),
  environment: "staging",
  stagingOnly: true,
  productionTouched: false,
  destructiveRestorePerformed: false,
  drillMode: "non_destructive_validation",
  incidentTimestamp,
  recoveryStartTimestamp: new Date(recoveryStart).toISOString(),
  validationCompletedTimestamp: new Date(validationEnd).toISOString(),
  targets: { rpoHours: 1, rtoHours: 2 },
  measured: {
    actualRpoHours,
    rpoPass,
    rpoNote,
    actualRtoMinutes: measuredRtoMinutes,
    rtoPass,
    rtoScope: "recovery validation pipeline only (seed + integrity + storage checks)",
    fullRestoreRtoMeasured: false,
  },
  integrityPass,
  allStepsPass,
  blP02Pass: rpoPass && rtoPass && integrityPass && allStepsPass,
  steps,
  pitr: audit?.pitr ?? null,
};

mkdirSync(COVERAGE, { recursive: true });
writeFileSync(DRILL_REPORT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("\n📊 Drill measurements\n");
console.log(`   Actual RPO:  ${actualRpoHours} h (${rpoPass ? "PASS" : "FAIL"}) — ${rpoNote}`);
console.log(`   Actual RTO:  ${measuredRtoMinutes} min (${rtoPass ? "PASS" : "FAIL"}) — validation scope`);
console.log(`   Integrity:   ${integrityPass ? "PASS" : "FAIL"}`);
console.log(`   BL-P0-2:     ${report.blP02Pass ? "PASS" : "OPEN / NO-GO"}`);
console.log(`\n→ ${DRILL_REPORT}\n`);

process.exit(report.blP02Pass ? 0 : 1);
