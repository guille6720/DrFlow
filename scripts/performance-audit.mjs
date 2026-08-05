#!/usr/bin/env node
/**
 * Collects performance audit metrics (bundle + lighthouse summary if present).
 * Usage: node scripts/performance-audit.mjs [--json]
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const jsonOut = process.argv.includes("--json");
const root = process.cwd();

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function bundleMetrics() {
  const statsPath = resolve(root, ".next/diagnostics/route-bundle-stats.json");
  if (!existsSync(statsPath)) return null;
  const stats = JSON.parse(readFileSync(statsPath, "utf8"));
  const pick = (route) => {
    const row = stats.find((r) => r.route === route);
    return row ? Math.round(row.firstLoadUncompressedJsBytes / 1024) : null;
  };
  const routes = [
    "/dashboard",
    "/pacientes/[id]",
    "/caja/cierre",
    "/agenda",
    "/login",
  ];
  return Object.fromEntries(routes.map((r) => [r, pick(r)]));
}

function lighthouseSummary() {
  return readJson(resolve(root, "coverage/lighthouse/summary.json"));
}

const report = {
  generatedAt: new Date().toISOString(),
  bundleKb: bundleMetrics(),
  lighthouse: lighthouseSummary(),
};

const outPath = resolve(root, "coverage/performance-audit-latest.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("\n⚡ DrFlow — Performance audit snapshot\n");
  console.log(`→ ${outPath}\n`);
  if (report.bundleKb) {
    console.log("First-load JS (KB, uncompressed):");
    for (const [route, kb] of Object.entries(report.bundleKb)) {
      console.log(`  ${String(kb ?? "—").padStart(5)}  ${route}`);
    }
  } else {
    console.log("Run `npm run build` first for bundle metrics.");
  }
  console.log("");
}
