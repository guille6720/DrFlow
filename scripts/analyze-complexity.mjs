#!/usr/bin/env node
/**
 * Heuristic complexity scan for src TypeScript files.
 * Usage: node scripts/analyze-complexity.mjs [--json]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, "src");
const THRESHOLDS = {
  lines: 80,
  params: 6,
  cyclomatic: 15,
  branches: 10,
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function countMatches(text, re) {
  return (text.match(re) ?? []).length;
}

function estimateCyclomatic(body) {
  let c = 1;
  c += countMatches(body, /\bif\s*\(/g);
  c += countMatches(body, /\belse\s+if\s*\(/g);
  c += countMatches(body, /\bfor\s*\(/g);
  c += countMatches(body, /\bwhile\s*\(/g);
  c += countMatches(body, /\bcase\s+/g);
  c += countMatches(body, /\bcatch\s*\(/g);
  c += countMatches(body, /\?\?/g);
  c += countMatches(body, /&&/g);
  c += countMatches(body, /\|\|/g);
  c += countMatches(body, /\?[^?].*?:/g);
  return c;
}

function countBranches(body) {
  return (
    countMatches(body, /\bif\s*\(/g) +
    countMatches(body, /\belse\s+if\s*\(/g) +
    countMatches(body, /\bcase\s+/g)
  );
}

function countParams(sig) {
  const inner = sig.replace(/^\(/, "").replace(/\)$/, "").trim();
  if (!inner) return 0;
  let depth = 0;
  let params = 1;
  for (const ch of inner) {
    if (ch === "<" || ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ">" || ch === ")" || ch === "}" || ch === "]") depth--;
    else if (ch === "," && depth === 0) params++;
  }
  return params;
}

function extractFunctions(content) {
  const results = [];
  const fnRe =
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(\([^)]*\)|<[^>]*>\s*\([^)]*\))/gm;
  const arrowRe =
    /^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gm;
  const methodRe =
    /^\s+(?:async\s+)?(\w+)\s*(\([^)]*\)|<[^>]*>\s*\([^)]*\))\s*(?::\s*[^{]+)?\{/gm;

  for (const re of [fnRe, arrowRe, methodRe]) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      const sig = m[2] ?? m[0].match(/\([^)]*\)/)?.[0] ?? "()";
      const startIdx = content.slice(0, m.index).split("\n").length;
      const braceStart = content.indexOf("{", m.index);
      if (braceStart === -1) continue;

      let depth = 0;
      let end = braceStart;
      for (let i = braceStart; i < content.length; i++) {
        const ch = content[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const body = content.slice(braceStart + 1, end);
      const bodyLines = body.split("\n").filter((l) => l.trim()).length;
      const endLine = content.slice(0, end + 1).split("\n").length;
      const params = countParams(sig);
      const cyclomatic = estimateCyclomatic(body);
      const branches = countBranches(body);
      const score = bodyLines + cyclomatic * 3 + params * 5;

      const flags = [];
      if (bodyLines >= THRESHOLDS.lines) flags.push("lines");
      if (params >= THRESHOLDS.params) flags.push("params");
      if (cyclomatic >= THRESHOLDS.cyclomatic) flags.push("cyclomatic");
      if (branches >= THRESHOLDS.branches) flags.push("branches");

      if (flags.length) {
        results.push({
          name,
          startLine: startIdx,
          endLine,
          bodyLines,
          params,
          cyclomatic,
          branches,
          score,
          flags,
        });
      }
    }
  }
  return results;
}

function main() {
  const files = walk(SRC);
  const all = [];

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const fn of extractFunctions(content)) {
      all.push({ file: relative(ROOT, file).replace(/\\/g, "/"), ...fn });
    }
  }

  all.sort((a, b) => b.score - a.score);
  const top = all.slice(0, 30);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ thresholds: THRESHOLDS, total: all.length, top }, null, 2));
    return;
  }

  console.log(`\nComplexity scan — ${all.length} function(s) over threshold\n`);
  for (const r of top) {
    console.log(
      `${r.file}:${r.startLine} ${r.name}() — lines=${r.bodyLines} params=${r.params} cc=${r.cyclomatic} branches=${r.branches} score=${r.score} [${r.flags.join(",")}]`
    );
  }
  console.log("");
}

main();
