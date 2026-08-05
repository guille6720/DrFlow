/**
 * Ensures a space after commas inside import/export brace lists.
 * Safe to run after eslint-plugin-simple-import-sort.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "tests", "scripts", "e2e"];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(path, files);
    } else if (/\.(ts|tsx|mjs|js)$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

function fixImportSpacing(content) {
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (!trimmed.startsWith("import ") && !trimmed.startsWith("export ")) return line;
      if (!line.includes("{")) return line;
      return line.replace(/\{([^}]+)\}/g, (_, inner) => `{${inner.replace(/,([^\s\n\r])/g, ", $1")}}`);
    })
    .join("\n");
}

let changed = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const before = readFileSync(file, "utf8");
    const after = fixImportSpacing(before);
    if (after !== before) {
      writeFileSync(file, after, "utf8");
      changed += 1;
    }
  }
}

console.log(`Fixed import spacing in ${changed} file(s).`);
