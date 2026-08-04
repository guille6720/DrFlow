/**
 * Code quality gate — TODO/FIXME, eslint-disable, console.log, unsafe any.
 * Usage: node scripts/code-quality-gate.mjs [--staged file1 file2 ...]
 */
import { execSync } from "child_process";
import { walkDir, rel, readSource, failGate, passGate, SRC_ROOT } from "./lib/quality-scan.mjs";

const ALLOW_CONSOLE = [
  "src/core/observability/dev-log.ts",
  "src/core/jobs/process.ts", // console.warn when service role missing
];

const TODO_FIXME_ALLOW = [
  "src/lib/constants/migration-reset.ts", // phrase "BORRAR TODO MIGRACION"
];

function getTargetFiles() {
  const stagedIdx = process.argv.indexOf("--staged");
  if (stagedIdx !== -1) {
    return process.argv.slice(stagedIdx + 1).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
  }
  return walkDir(SRC_ROOT);
}

function scanFile(filePath) {
  const r = rel(filePath);
  const content = readSource(filePath);
  const lines = content.split("\n");
  const violations = [];

  if (!TODO_FIXME_ALLOW.includes(r)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\bTODO\b/.test(line) && !line.trimStart().startsWith("*")) {
        violations.push(`${r}:${i + 1} — TODO comment`);
      }
      if (/\bFIXME\b/.test(line)) {
        violations.push(`${r}:${i + 1} — FIXME comment`);
      }
    }
  }

  if (/eslint-disable/.test(content)) {
    violations.push(`${r} — eslint-disable present (fix root cause)`);
  }

  if (/@ts-ignore|@ts-nocheck/.test(content)) {
    violations.push(`${r} — @ts-ignore or @ts-nocheck`);
  }

  if (/\bas any\b|: any\b/.test(content)) {
    violations.push(`${r} — unsafe "any" type`);
  }

  if (!ALLOW_CONSOLE.includes(r)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/console\.(log|debug|info)\(/.test(line)) {
        violations.push(`${r}:${i + 1} — console.log/debug/info in production code`);
      }
    }
  }

  return violations;
}

function main() {
  console.log("\n🔍 DrFlow — Code quality gate\n");

  const files = getTargetFiles();
  if (!files.length) {
    passGate("Code quality gate OK (no files to scan)");
    return;
  }

  const violations = files.flatMap(scanFile);

  if (violations.length) {
    failGate("Code quality gate failed", violations);
  }

  passGate("Code quality gate OK", [`${files.length} file(s) scanned`]);
}

main();
