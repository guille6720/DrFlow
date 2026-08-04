/**
 * Stabilization gate — prevent regression on architecture debt (Risk 1 + Risk 2).
 * - No NEW components >200 lines or hooks >150 lines
 * - Baseline grandfathered files must not grow in line count
 * - Hooks under src/components/** must live in src/lib/hooks/
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { walkDir, rel, lineCount, failGate, passGate, SRC_ROOT } from "./lib/quality-scan.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(__dirname, "stabilization-baseline.json");

const COMPONENT_MAX = 200;
const HOOK_MAX = 150;

function loadBaseline() {
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
}

function scanOversizedComponents(baseline) {
  const violations = [];
  const warnings = [];

  for (const filePath of walkDir(`${SRC_ROOT}/components`)) {
    if (!filePath.endsWith(".tsx")) continue;
    const r = rel(filePath);
    const lines = lineCount(filePath);
    const baselineLines = baseline.components[r];

    if (baselineLines != null) {
      if (lines > baselineLines) {
        violations.push(
          `${r} — ${lines} lines (baseline ${baselineLines}; must not grow — split component)`
        );
      }
      continue;
    }

    if (lines > COMPONENT_MAX) {
      violations.push(
        `${r} — ${lines} lines (max ${COMPONENT_MAX} for new components — extract hook/service)`
      );
    }
  }

  return { violations, warnings };
}

function scanOversizedHooks(baseline) {
  const violations = [];

  const hookDirs = [`${SRC_ROOT}/lib/hooks`, `${SRC_ROOT}/components`];

  for (const dir of hookDirs) {
    for (const filePath of walkDir(dir)) {
      if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) continue;
      const base = filePath.split(/[/\\]/).pop() ?? "";
      if (!base.startsWith("use-") && !base.includes("use-completed")) continue;

      const r = rel(filePath);

      if (r.startsWith("src/components/")) {
        violations.push(`${r} — hook in components/ (move to src/lib/hooks/)`);
        continue;
      }

      const lines = lineCount(filePath);
      const baselineLines = baseline.hooks[r];

      if (baselineLines != null) {
        if (lines > baselineLines) {
          violations.push(
            `${r} — ${lines} lines (baseline ${baselineLines}; must not grow — split hook)`
          );
        }
        continue;
      }

      if (lines > HOOK_MAX) {
        violations.push(
          `${r} — ${lines} lines (max ${HOOK_MAX} for new hooks — split by concern)`
        );
      }
    }
  }

  return violations;
}

function main() {
  console.log("\n🛡 DrFlow — Stabilization gate\n");

  const baseline = loadBaseline();
  const { violations: componentViolations } = scanOversizedComponents(baseline);
  const hookViolations = scanOversizedHooks(baseline);
  const violations = [...componentViolations, ...hookViolations];

  const baselineComponentCount = Object.keys(baseline.components).length;
  const baselineHookCount = Object.keys(baseline.hooks).length;

  if (violations.length) {
    failGate("Stabilization gate failed", violations);
  }

  passGate("Stabilization gate OK", [
    `No new components >${COMPONENT_MAX} lines`,
    `No new hooks >${HOOK_MAX} lines`,
    `${baselineComponentCount} baseline component(s) within cap`,
    `${baselineHookCount} baseline hook(s) within cap`,
    "No hooks under src/components/",
  ]);
}

main();
