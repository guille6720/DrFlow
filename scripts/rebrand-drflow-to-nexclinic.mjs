/**
 * Staging rebrand helper: replace user-visible brand token "DrFlow" → "NexClinic".
 * Does NOT touch: drflow- CSS classes, cookies, DRFLOW_* env keys, MP SKUs, migrations.
 *
 * Usage: node scripts/rebrand-drflow-to-nexclinic.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOTS = ["src", "tests", "e2e"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".md", ".html"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage", ".git"]);

const files = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (EXTS.has(path.extname(ent.name))) files.push(p);
  }
}

for (const r of ROOTS) {
  const abs = path.join(ROOT, r);
  if (fs.existsSync(abs)) walk(abs);
}

let changed = 0;
const list = [];

for (const file of files) {
  const orig = fs.readFileSync(file, "utf8");
  let text = orig;
  text = text.replace(/\bDrFlow\b/g, "NexClinic");
  text = text.replace(/\bDr Flow\b/g, "NexClinic");
  if (text !== orig) {
    fs.writeFileSync(file, text);
    changed += 1;
    list.push(path.relative(ROOT, file));
  }
}

console.log(JSON.stringify({ files_changed: changed, files: list }, null, 2));
