#!/usr/bin/env node
/**
 * Summarizes Next.js route bundle sizes from diagnostics output.
 * Run after `npm run build`: node scripts/analyze-bundle.mjs [--json]
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const jsonOut = process.argv.includes("--json");
const root = process.cwd();
const statsPath = resolve(root, ".next/diagnostics/route-bundle-stats.json");

if (!existsSync(statsPath)) {
  console.error("Missing .next/diagnostics/route-bundle-stats.json — run `npm run build` first.");
  process.exit(1);
}

const stats = JSON.parse(readFileSync(statsPath, "utf8"));
const fmtKb = (bytes) => Math.round(bytes / 1024);

const heaviest = [...stats]
  .sort((a, b) => b.firstLoadUncompressedJsBytes - a.firstLoadUncompressedJsBytes)
  .slice(0, 12)
  .map((r) => ({
    route: r.route,
    firstLoadKb: fmtKb(r.firstLoadUncompressedJsBytes),
    chunks: r.firstLoadChunkPaths.length,
  }));

const watchRoutes = ["/dashboard", "/pacientes/[id]", "/recetas", "/historias/[id]", "/login"];
const keyRoutes = watchRoutes
  .map((route) => stats.find((r) => r.route === route))
  .filter(Boolean)
  .map((r) => ({
    route: r.route,
    firstLoadKb: fmtKb(r.firstLoadUncompressedJsBytes),
    chunks: r.firstLoadChunkPaths.length,
  }));

const report = {
  totalRoutes: stats.length,
  heaviestFirstLoad: heaviest,
  keyRoutes,
};

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("\n📦 DrFlow — Bundle analysis\n");
  console.log(`Routes compiled: ${report.totalRoutes}`);
  console.log("\nHeaviest First Load JS (uncompressed):");
  for (const r of heaviest) {
    console.log(`  ${String(r.firstLoadKb).padStart(5)} KB  ${r.chunks} chunks  ${r.route}`);
  }
  console.log("\nKey routes:");
  for (const r of keyRoutes) {
    console.log(`  ${String(r.firstLoadKb).padStart(5)} KB  ${r.chunks} chunks  ${r.route}`);
  }
  console.log("");
}
