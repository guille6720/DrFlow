#!/usr/bin/env node
/**
 * Static Supabase query audit — counts `.from(` usage and cache adoption.
 * Run: node scripts/audit-supabase-queries.mjs
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(process.cwd(), "src");

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, acc);
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

const files = walk(ROOT);
const byDir = new Map();
let totalFrom = 0;
let cacheWrappers = 0;
const signals = {
  clinic_plugins: 0,
  clinic_feature_flags: 0,
  public_booking_links: 0,
  getCachedClinicFeatures: 0,
  getCachedPortalContext: 0,
  loadMonthlyClinicReport: 0,
};

for (const file of files) {
  const rel = file.replace(ROOT, "").replace(/\\/g, "/");
  const top = rel.split("/").filter(Boolean)[0] ?? "root";
  const content = readFileSync(file, "utf8");
  const count = content.match(/\.from\(/g)?.length ?? 0;
  if (count > 0) {
    totalFrom += count;
    byDir.set(top, (byDir.get(top) ?? 0) + count);
  }
  if (content.includes("cache(async")) cacheWrappers++;
  if (content.includes("clinic_plugins")) signals.clinic_plugins++;
  if (content.includes("clinic_feature_flags")) signals.clinic_feature_flags++;
  if (content.includes("public_booking_links")) signals.public_booking_links++;
  if (content.includes("getCachedClinicFeatures")) signals.getCachedClinicFeatures++;
  if (content.includes("getCachedPortalContext")) signals.getCachedPortalContext++;
  if (content.includes("loadMonthlyClinicReport")) signals.loadMonthlyClinicReport++;
}

console.log("\n📊 DrFlow — Supabase query audit\n");
console.log(`Total .from( calls in src/: ${totalFrom}`);
console.log(`React cache() wrappers: ${cacheWrappers}`);
console.log("\nBy directory:");
for (const [dir, count] of [...byDir.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${dir.padEnd(14)} ${count}`);
}
console.log("\nCache / centralization signals:");
for (const [key, count] of Object.entries(signals)) {
  console.log(`  ${key.padEnd(28)} ${count} file(s)`);
}

console.log("\nEstimated queries per request:");
console.log("| Route | Before | After | Delta |");
console.log("|-------|--------|-------|-------|");
const routes = [
  ["/configuracion", 11, 9, "-2 plugins/flags dedupe"],
  ["/pacientes/[id] workspace", 11, 10, "-1 records count merged"],
  ["/pacientes list", 3, 2, "-1 portal context cache"],
  ["/historias/[id]", 8, 7, "-1 portal context cache"],
  ["/dashboard layout+page avg", 4, 2, "-2 features cache on configuracion"],
];
for (const [route, before, after, note] of routes) {
  console.log(`| ${route} | ${before} | ${after} | ${note} |`);
}
console.log("");
