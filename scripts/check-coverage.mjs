/**
 * Verifica cobertura mínima Phase 19 (core lib ≥90%).
 * Uso: node scripts/check-coverage.mjs
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const SUMMARY_PATH = resolve(process.cwd(), "coverage/coverage-summary.json");
const MIN_LINES = 90;
const MIN_STATEMENTS = 90;

function main() {
  console.log("\n🧪 DrFlow — Coverage gate (Phase 19)\n");

  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vitest", "run", "--coverage"],
    { stdio: "inherit", shell: process.platform === "win32" }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (!existsSync(SUMMARY_PATH)) {
    console.error("❌ No se generó coverage/coverage-summary.json\n");
    process.exit(1);
  }

  const summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf8"));
  const total = summary.total;
  const linesPct = total.lines.pct;
  const statementsPct = total.statements.pct;

  console.log(`\n📊 Core lib — lines ${linesPct}% · statements ${statementsPct}%\n`);

  if (linesPct < MIN_LINES) {
    console.error(`❌ Cobertura insuficiente (mínimo ${MIN_LINES}% lines)\n`);
    process.exit(1);
  }

  if (statementsPct < MIN_STATEMENTS) {
    console.log(`⚠ Statements ${statementsPct}% — target ${MIN_STATEMENTS}% (lines OK)\n`);
  }

  console.log("✅ Coverage gate OK\n");
}

main();
