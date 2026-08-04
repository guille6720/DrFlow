/**
 * Stabilization audit — metrics for enterprise reports.
 * Usage: node scripts/stabilization-audit.mjs [--write]
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { walkDir, rel, lineCount, readSource, SRC_ROOT } from "./lib/quality-scan.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function countTodoFixme() {
  let count = 0;
  for (const filePath of walkDir(SRC_ROOT)) {
    if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) continue;
    const r = rel(filePath);
    if (r === "src/lib/constants/migration-reset.ts") continue;
    const content = readSource(filePath);
    if (/\bTODO\b/.test(content) || /\bFIXME\b/.test(content)) count++;
  }
  return count;
}

function scanSizes() {
  const components = [];
  const hooks = [];

  for (const filePath of walkDir(`${SRC_ROOT}/components`)) {
    if (!filePath.endsWith(".tsx")) continue;
    components.push({ path: rel(filePath), lines: lineCount(filePath) });
  }
  for (const filePath of walkDir(`${SRC_ROOT}/lib/hooks`)) {
    if (!filePath.endsWith(".ts")) continue;
    hooks.push({ path: rel(filePath), lines: lineCount(filePath) });
  }

  components.sort((a, b) => b.lines - a.lines);
  hooks.sort((a, b) => b.lines - a.lines);

  return {
    components,
    hooks,
    over200Components: components.filter((c) => c.lines > 200).length,
    over150Hooks: hooks.filter((h) => h.lines > 150).length,
    topComponents: components.slice(0, 15),
    topHooks: hooks.slice(0, 15),
  };
}

function countTests() {
  const vitest = walkDir(join(ROOT, "tests")).filter((f) => f.endsWith(".test.ts")).length;
  const e2e = walkDir(join(ROOT, "e2e")).filter((f) => f.endsWith(".spec.ts")).length;
  return { vitest, e2e, total: vitest + e2e };
}

function main() {
  const write = process.argv.includes("--write");
  const sizes = scanSizes();
  const tests = countTests();

  let coverageSummary = {};
  try {
    const cov = readFileSync(join(ROOT, "coverage/coverage-summary.json"), "utf8");
    coverageSummary = JSON.parse(cov).total ?? {};
  } catch {
    coverageSummary = { note: "Run npm test with coverage first" };
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    todoFixmeFiles: countTodoFixme(),
    architecture: sizes,
    tests,
    coverage: coverageSummary,
    healthEndpoints: [
      "/api/health/live",
      "/api/health/ready",
      "/api/health",
      "/api/version",
    ],
    gates: [
      "typecheck",
      "lint",
      "code-quality-gate",
      "security-gate",
      "architecture-gate",
      "stabilization-gate",
      "architecture-review (PR strict)",
      "test",
      "check:coverage",
      "check-critical-coverage",
      "performance-gate",
      "test:rls:static",
      "build",
      "health-smoke (CI)",
    ],
  };

  const outPath = join(ROOT, "coverage/stabilization-audit.json");
  if (write) {
    writeFileSync(outPath, JSON.stringify(audit, null, 2));
    console.log(`Wrote ${outPath}`);
  } else {
    console.log(JSON.stringify(audit, null, 2));
  }
}

main();
