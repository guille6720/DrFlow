/**
 * Performance gate — benchmark tests + component metrics report.
 * Usage: node scripts/performance-gate.mjs
 */
import { spawnSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

import { failGate, lineCount, passGate, rel, walkComponentFiles } from "./lib/quality-scan.mjs";

const METRICS_PATH = resolve(process.cwd(), "coverage/performance-metrics.json");
const LARGE_COMPONENT_THRESHOLD = 250;

function collectComponentMetrics() {
  const components = [];
  for (const filePath of walkComponentFiles(".tsx")) {
    const lines = lineCount(filePath);
    components.push({ file: rel(filePath), lines });
  }
  components.sort((a, b) => b.lines - a.lines);
  return {
    generatedAt: new Date().toISOString(),
    largeComponents: components.filter((c) => c.lines >= LARGE_COMPONENT_THRESHOLD),
    top10: components.slice(0, 10),
    totalComponents: components.length,
  };
}

function runPerfTests() {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "test:perf"],
    { stdio: "inherit", shell: process.platform === "win32" }
  );
  return result.status ?? 1;
}

function main() {
  console.log("\n⚡ DrFlow — Performance gate\n");

  mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true });
  const metrics = collectComponentMetrics();
  writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2));
  console.log(`📊 Metrics → ${METRICS_PATH}`);
  console.log(
    `   ${metrics.largeComponents.length} component(s) ≥ ${LARGE_COMPONENT_THRESHOLD} lines\n`
  );

  const perfStatus = runPerfTests();
  if (perfStatus !== 0) {
    failGate("Performance gate failed", ["Performance benchmark tests failed"]);
  }

  passGate("Performance gate OK", [
    `${metrics.totalComponents} components measured`,
    "Benchmark tests passed",
  ]);
}

main();
