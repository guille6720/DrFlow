/**
 * Master quality gate — runs all enterprise validations in order.
 * Usage: node scripts/quality-gate.mjs [--skip-build]
 */
import { spawnSync } from "child_process";

const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--skip-build");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function run(label, command, commandArgs = [], options = {}) {
  console.log(`\n▶ ${label}\n`);
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if ((result.status ?? 1) !== 0) {
    console.error(`\n❌ Quality gate failed at: ${label}\n`);
    process.exit(result.status ?? 1);
  }
}

function npmScript(script) {
  run(script, npmCmd, ["run", script]);
}

console.log("\n🏁 DrFlow — Enterprise Quality Gate\n");

npmScript("typecheck");
npmScript("lint");
run("code-quality:gate", "node", ["scripts/code-quality-gate.mjs"]);
run("security:gate", "node", ["scripts/security-gate.mjs"]);
run("architecture:gate", "node", ["scripts/architecture-gate.mjs"]);
npmScript("test");
npmScript("check:coverage");
run("critical-coverage", "node", ["scripts/check-critical-coverage.mjs"]);
npmScript("performance:gate");
npmScript("test:rls:static");

if (!skipBuild) {
  npmScript("build");
}

console.log("\n✅ Enterprise quality gate passed\n");
