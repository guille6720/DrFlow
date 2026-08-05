#!/usr/bin/env node
/**
 * Codemod: rewrite imports from @deprecated stub paths → canonical paths, then delete stubs.
 *
 * Preserves:
 *   - src/components/ui/*  (canonical UI primitives; except explicit stub files)
 *   - src/lib/* real implementations (non-stub files)
 *
 * Usage:
 *   node scripts/remove-legacy-stubs.mjs          # dry-run
 *   node scripts/remove-legacy-stubs.mjs --apply  # rewrite + delete
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, "src");
const APPLY = process.argv.includes("--apply");

/** UI primitives stay at @/components/ui — not migration stubs. */
const UI_PRIMITIVE_DIR = join(SRC, "components", "ui");

/** Extra stub inside ui/ */
const UI_STUB_FILES = new Set([
  resolve(SRC, "components/ui/patient-whatsapp-button.tsx"),
]);

function walkTsFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(p, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

function toImportPath(absPath) {
  return `@/${relative(SRC, absPath).replace(/\\/g, "/").replace(/\.tsx?$/, "")}`;
}

function isStubFile(absPath, content) {
  if (absPath.startsWith(UI_PRIMITIVE_DIR) && !UI_STUB_FILES.has(absPath)) {
    return false;
  }
  if (!content.startsWith("/** @deprecated")) return false;

  const body = content.replace(/^\/\*\*[\s\S]*?\*\/\s*/, "").trim();
  if (!body) return false;

  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.length > 0 && lines.every((l) => /^export\s/.test(l));
}

function parseCanonicalTarget(content) {
  const matches = [...content.matchAll(/from\s+["'](@\/[^"']+)["']/g)];
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0][1];

  // Multi-export stub — all targets must match for simple re-export stub
  const targets = new Set(matches.map((m) => m[1]));
  if (targets.size === 1) return [...targets][0];
  return null;
}

function collectStubs() {
  const scanRoots = [
    join(SRC, "components"),
    join(SRC, "lib"),
  ];

  /** @type {Array<{ stubPath: string, canonical: string, file: string }>} */
  const stubs = [];

  for (const root of scanRoots) {
    for (const file of walkTsFiles(root)) {
      const content = readFileSync(file, "utf8");
      if (!isStubFile(file, content)) continue;

      const canonical = parseCanonicalTarget(content);
      if (!canonical) {
        console.warn(`  skip multi-target stub: ${relative(ROOT, file)}`);
        continue;
      }

      const stubPath = toImportPath(file);
      if (stubPath === canonical) {
        console.warn(`  skip self-ref stub: ${stubPath}`);
        continue;
      }

      stubs.push({ stubPath, canonical, file });
    }
  }

  return stubs.sort((a, b) => b.stubPath.length - a.stubPath.length);
}

function expandStubAliases(stubs) {
  /** @type {Array<{ stubPath: string, canonical: string, file?: string }>} */
  const expanded = [...stubs];

  for (const { stubPath, canonical, file } of stubs) {
    if (stubPath.endsWith("/index")) {
      const parentStub = stubPath.slice(0, -"/index".length);
      const parentCanonical = canonical.endsWith("/index")
        ? canonical.slice(0, -"/index".length)
        : canonical;
      expanded.push({ stubPath: parentStub, canonical: parentCanonical, file });
    }

    // next.config.ts and similar use ./src/... instead of @/
    if (stubPath.startsWith("@/")) {
      const relFromRoot = `./src/${stubPath.slice(2)}`;
      const relCanonical = `./src/${canonical.slice(2)}`;
      expanded.push({ stubPath: relFromRoot, canonical: relCanonical, file });

      if (stubPath.endsWith("/index")) {
        const parentStub = relFromRoot.slice(0, -"/index".length);
        const parentCanonical = relCanonical.endsWith("/index")
          ? relCanonical.slice(0, -"/index".length)
          : relCanonical;
        expanded.push({ stubPath: parentStub, canonical: parentCanonical, file });
      }
    }
  }

  const seen = new Set();
  return expanded
    .filter(({ stubPath, canonical }) => {
      const key = `${stubPath}→${canonical}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return stubPath !== canonical;
    })
    .sort((a, b) => b.stubPath.length - a.stubPath.length);
}

function rewriteImports(stubs) {
  const aliases = expandStubAliases(stubs);
  const scanRoots = ["src", "tests", "scripts"].map((d) => join(ROOT, d));
  /** Root-level TS/JS config files using relative ./src/ imports */
  const rootConfigFiles = ["next.config.ts", "next.config.mjs"].map((f) => join(ROOT, f));
  const stubFiles = new Set(stubs.map((s) => s.file));
  let filesChanged = 0;
  let replacements = 0;

  function processFile(file) {
    if (stubFiles.has(file)) return;
    if (!/\.(tsx?|mjs)$/.test(file)) return;
    if (!existsSync(file)) return;

    let content = readFileSync(file, "utf8");
    let next = content;

    for (const { stubPath, canonical } of aliases) {
      if (!next.includes(stubPath)) continue;
      const count = next.split(stubPath).length - 1;
      next = next.split(stubPath).join(canonical);
      replacements += count;
    }

    if (next !== content) {
      filesChanged++;
      if (APPLY) writeFileSync(file, next, "utf8");
    }
  }

  for (const root of scanRoots) {
    if (!existsSync(root)) continue;
    for (const file of walkTsFiles(root)) processFile(file);
  }
  for (const file of rootConfigFiles) processFile(file);

  return { filesChanged, replacements, aliasCount: aliases.length };
}

function deleteStubs(stubs) {
  let deleted = 0;
  for (const { file } of stubs) {
    if (!existsSync(file)) continue;
    rmSync(file);
    deleted++;
  }

  // Remove empty directories bottom-up
  const dirs = new Set(stubs.map((s) => dirname(s.file)));
  for (const dir of [...dirs].sort((a, b) => b.length - a.length)) {
    if (dir === join(SRC, "components") || dir === join(SRC, "lib")) continue;
    if (!existsSync(dir)) continue;
    try {
      if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
    } catch {
      /* non-empty */
    }
  }

  return deleted;
}

function main() {
  console.log(`\n🧹 Legacy stub codemod ${APPLY ? "(APPLY)" : "(dry-run)"}\n`);

  const stubs = collectStubs();
  console.log(`Found ${stubs.length} stub file(s)\n`);

  const { filesChanged, replacements, aliasCount } = rewriteImports(stubs);
  console.log(`Import replacements: ${replacements} in ${filesChanged} file(s) (${aliasCount} alias paths)`);

  if (APPLY) {
    const deleted = deleteStubs(stubs);
    console.log(`Deleted ${deleted} stub file(s)`);
  } else {
    console.log("\nRun with --apply to write changes and delete stubs.");
  }

  const report = {
    mode: APPLY ? "apply" : "dry-run",
    stubCount: stubs.length,
    filesChanged,
    replacements,
    stubs: stubs.map(({ stubPath, canonical, file }) => ({
      stubPath,
      canonical,
      file: relative(ROOT, file),
    })),
  };

  mkdirSync(join(ROOT, "coverage"), { recursive: true });
  writeFileSync(
    join(ROOT, "coverage", "stub-removal-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log(`\nReport: coverage/stub-removal-report.json\n`);
}

main();
