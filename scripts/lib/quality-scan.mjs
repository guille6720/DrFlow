/**
 * Shared file scanning utilities for quality gates.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, relative, extname, join } from "path";

export const SRC_ROOT = resolve(process.cwd(), "src");
export const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

export function walkDir(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkDir(full, files);
    } else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

export function rel(filePath) {
  return relative(process.cwd(), filePath).replace(/\\/g, "/");
}

export function readSource(filePath) {
  return readFileSync(filePath, "utf8");
}

export function lineCount(filePath) {
  return readSource(filePath).split("\n").length;
}

export function filterFiles(allFiles, { only, except = [] } = {}) {
  if (!only?.length) return allFiles.filter((f) => !except.some((x) => rel(f).includes(x)));
  return allFiles.filter((f) => {
    const r = rel(f);
    if (except.some((x) => r.includes(x))) return false;
    return only.some((x) => r.includes(x) || r.endsWith(x));
  });
}

export function failGate(title, violations) {
  console.error(`\n❌ ${title}\n`);
  for (const v of violations) {
    console.error(`  • ${v}`);
  }
  console.error("");
  process.exit(1);
}

export function passGate(title, details = []) {
  console.log(`\n✅ ${title}`);
  for (const d of details) console.log(`   ${d}`);
  console.log("");
}
