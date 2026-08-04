#!/usr/bin/env node
/** Fix @/src/... transition paths → @/core/... */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd(), "src/lib");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

let fixed = 0;
for (const file of walk(ROOT)) {
  const content = readFileSync(file, "utf8");
  if (!content.includes("@/src/")) continue;
  const next = content.replaceAll("@/src/", "@/");
  writeFileSync(file, next, "utf8");
  fixed++;
}
console.log(`Fixed ${fixed} transition file(s)`);
