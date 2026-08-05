/**
 * Critical module coverage gate — 95–100% on auth, authz, clinical workflows.
 * Requires prior `vitest run --coverage` (run via check:coverage or quality:gate).
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { CRITICAL_COVERAGE } from "./critical-coverage-rules.mjs";

const SUMMARY_PATH = resolve(process.cwd(), "coverage/coverage-summary.json");

function normalizePath(p) {
  return p.replace(/\\/g, "/");
}

function main() {
  console.log("\n🎯 DrFlow — Critical coverage gate\n");

  if (!existsSync(SUMMARY_PATH)) {
    console.error("❌ Run coverage first: npm run check:coverage\n");
    process.exit(1);
  }

  const summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf8"));
  const violations = [];

  for (const rule of CRITICAL_COVERAGE) {
    const matched = Object.entries(summary).filter(([filePath]) => {
      if (filePath === "total") return false;
      return rule.match(normalizePath(filePath));
    });

    if (!matched.length) {
      violations.push(`${rule.label} — no files matched (add tests or scope)`);
      continue;
    }

    let totalLines = 0;
    let coveredLines = 0;
    let totalStatements = 0;
    let coveredStatements = 0;

    for (const [, metrics] of matched) {
      totalLines += metrics.lines.total;
      coveredLines += metrics.lines.covered;
      totalStatements += metrics.statements.total;
      coveredStatements += metrics.statements.covered;
    }

    const linesPct = totalLines ? (coveredLines / totalLines) * 100 : 100;
    const statementsPct = totalStatements ? (coveredStatements / totalStatements) * 100 : 100;

    console.log(
      `  ${rule.label}: lines ${linesPct.toFixed(1)}% · statements ${statementsPct.toFixed(1)}% (min ${rule.minLines}/${rule.minStatements})`
    );

    if (linesPct < rule.minLines) {
      violations.push(`${rule.label} — lines ${linesPct.toFixed(1)}% below ${rule.minLines}%`);
    }
  }

  if (violations.length) {
    console.error("\n❌ Critical coverage gate failed\n");
    for (const v of violations) console.error(`  • ${v}`);
    console.error("");
    process.exit(1);
  }

  console.log("\n✅ Critical coverage gate OK\n");
}

main();
