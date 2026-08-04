/**
 * Architecture review gate — flags changes that require a human ADR note.
 * Usage:
 *   node scripts/architecture-review.mjs              # report (exit 0)
 *   node scripts/architecture-review.mjs --strict     # fail if triggers without ADR
 *   node scripts/architecture-review.mjs --base main  # diff against base branch
 */
import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import {
  collectArchitectureTriggers,
  hasArchitectureReviewNote,
} from "./lib/architecture-review-rules.mjs";
import { lineCount, rel, failGate, passGate } from "./lib/quality-scan.mjs";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const baseIdx = process.argv.indexOf("--base");
const baseRef = baseIdx !== -1 ? process.argv[baseIdx + 1] : "origin/main";

function gitChangedFiles() {
  try {
    const out = execSync(`git diff --name-only ${baseRef}...HEAD`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!out) return [];
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function gitIsNewFile(file) {
  try {
    const out = execSync(`git diff --name-only --diff-filter=A ${baseRef}...HEAD -- "${file}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function metaFor(file) {
  const abs = resolve(process.cwd(), file);
  const isNew = gitIsNewFile(file);
  const lines = existsSync(abs) ? lineCount(abs) : 0;
  return { isNew, lineCount: lines };
}

function main() {
  console.log("\n📐 DrFlow — Architecture review triggers\n");

  const changed = gitChangedFiles();
  if (!changed.length) {
    passGate("Architecture review OK", ["No diff vs base — nothing to review"]);
    return;
  }

  const triggers = collectArchitectureTriggers(changed, metaFor);
  const adrPresent = hasArchitectureReviewNote(changed);

  if (!triggers.length) {
    passGate("Architecture review OK", [
      `${changed.length} file(s) changed — no mandatory review triggers`,
    ]);
    return;
  }

  console.log("⚠️  Mandatory architecture review triggers:\n");
  for (const t of triggers) {
    console.log(`   • [${t.id}] ${t.reason}`);
    console.log(`     ${t.file}`);
  }
  console.log("");

  if (adrPresent) {
    passGate("Architecture review OK", [
      `${triggers.length} trigger(s) — ADR note found in docs/architecture-reviews/`,
    ]);
    return;
  }

  console.log("📋 Required before merge:");
  console.log("   1. Complete checklist → docs/ARCHITECTURE_REVIEW.md");
  console.log("   2. Add ADR note → docs/architecture-reviews/NNN-feature-name.md");
  console.log("   3. Check PR template → Architecture section\n");

  if (strict) {
    failGate("Architecture review required (add docs/architecture-reviews/*.md)", [
      `${triggers.length} trigger(s) without ADR note`,
    ]);
  }

  console.log("ℹ️  Non-strict mode — CI uses --strict on pull requests.\n");
}

main();
