#!/usr/bin/env node
/**
 * Phase 5 — scan migrations for destructive SQL; require explicit override comment.
 *
 * Usage:
 *   node scripts/disaster-recovery/migration-preflight.mjs
 *   node scripts/disaster-recovery/migration-preflight.mjs --file supabase/migrations/099_example.sql
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const OVERRIDE_MARKERS = [
  "DRFLOW_DESTRUCTIVE_MIGRATION_REVIEWED",
  "-- @drflow-destructive-ok",
];

const DESTRUCTIVE_PATTERNS = [
  { id: "drop_table", re: /\bDROP\s+TABLE\b/i, severity: "P0" },
  { id: "drop_column", re: /\bDROP\s+COLUMN\b/i, severity: "P0" },
  { id: "truncate", re: /\bTRUNCATE\s+(?:TABLE|ONLY)?\s*\w/i, severity: "P0" },
  { id: "mass_delete", re: /\bDELETE\s+FROM\s+\w+\s*;/i, severity: "P1" },
  { id: "unsafe_alter", re: /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+(?:COLUMN|CONSTRAINT)\b/i, severity: "P0" },
];

function hasOverride(sql) {
  return OVERRIDE_MARKERS.some((m) => sql.includes(m));
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

function scanFile(path, sql) {
  const executable = stripSqlComments(sql);
  const findings = [];
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.re.test(executable)) {
      findings.push({
        file: path,
        pattern: pattern.id,
        severity: pattern.severity,
        overridden: hasOverride(sql),
      });
    }
  }
  return findings;
}

function main() {
  const enforce = process.argv.includes("--enforce");
  const fileArg = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
  const migrationsDir = resolve(process.cwd(), "supabase/migrations");
  const files = fileArg
    ? [fileArg]
    : readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((f) => join(migrationsDir, f));

  const allFindings = [];
  for (const file of files) {
    const sql = readFileSync(file, "utf8");
    allFindings.push(...scanFile(file.replace(/\\/g, "/"), sql));
  }

  const blocked = allFindings.filter((f) => !f.overridden);

  console.log("\n🛡 Phase 5 — Migration preflight (destructive SQL guard)\n");
  if (allFindings.length === 0) {
    console.log("✓ No destructive patterns detected\n");
    process.exit(0);
  }

  for (const f of allFindings) {
    const status = f.overridden ? "OVERRIDE OK" : "BLOCKED";
    console.log(`   [${f.severity}] ${f.pattern} in ${f.file} — ${status}`);
  }

  if (blocked.length) {
    if (enforce) {
      console.log(
        "\n❌ Destructive migration without review marker.\n" +
          "   Add `-- @drflow-destructive-ok` or `DRFLOW_DESTRUCTIVE_MIGRATION_REVIEWED` after DBA review.\n"
      );
      process.exit(1);
    }
    console.log(
      `\n⚠ ${blocked.length} historical/unmarked destructive pattern(s) — informational (use --enforce to fail CI).\n`
    );
    process.exit(0);
  }

  console.log("\n✅ All destructive migrations have explicit override markers\n");
}

main();
