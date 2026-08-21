#!/usr/bin/env node
/**
 * Gate for theme/a11y-only commits (brief §14).
 *
 * Usage:
 *   node scripts/check-a11y-theme-scope.mjs
 *     → checks `git diff --name-only` (staged + unstaged) and fails if any
 *       path is classified forbidden for a theme commit.
 *
 *   node scripts/check-a11y-theme-scope.mjs --theme-only
 *     → ignores unrelated WIP; fails only when a changed file is under a
 *       forbidden prefix AND looks like it was pulled into a theme commit
 *       (i.e. mixed with theme files). Prefer committing theme files alone.
 *
 *   node scripts/check-a11y-theme-scope.mjs --files a,b,c
 *     → classify an explicit list (CI / pre-commit).
 */

import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Keep in sync with src/core/theme/a11y-scope.ts (duplicated for zero-build script).
const PRESENTATION_ALLOWLIST = new Set([
  "src/app/(dashboard)/superadmin/layout.tsx",
  "src/features/pacientes/components/pacientes/workspace/patient-workspace-overlay.tsx",
  "src/features/historias/components/consultas/drapp-consulta-full-modal.tsx",
  "src/features/historias/components/historias/diagnosis-related-actions-panel.tsx",
  "src/features/agenda/components/agenda/cancel-appointment-dialog.tsx",
  "src/features/agenda/components/agenda/calendar-appointment-dialog.tsx",
  "src/features/agenda/components/agenda/edit-appointment-dialog.tsx",
  "src/features/agenda/components/agenda/reschedule-appointment-dialog.tsx",
  "src/features/recetas/components/recetas/whatsapp-share-confirm-dialog.tsx",
  "src/features/configuracion/components/configuracion/delete-account-panel.tsx",
]);

const ALLOWED_PREFIXES = [
  "src/core/theme/",
  "src/app/globals.css",
  "src/core/app-release.ts",
  "src/components/ui/",
  "src/core/components/theme/",
  "src/core/components/layout/guest-appearance-modal.tsx",
  "src/core/components/layout/user-account-modal.tsx",
  "src/core/components/layout/user-account-modal-content.tsx",
  "src/core/qa/checklist-data.ts",
  "src/features/configuracion/components/configuracion/appearance-style-panel.tsx",
  "e2e/a11y-",
  "e2e/helpers/a11y.ts",
  "e2e/helpers/theme.ts",
  "e2e/helpers/auth.ts",
  "playwright.config.ts",
  "tests/",
  "package.json",
  "package-lock.json",
  "scripts/audit-problematic-css",
  "scripts/check-a11y-theme-scope",
];

const FORBIDDEN_PREFIXES = [
  "supabase/migrations/",
  "supabase/seeds/",
  "supabase/functions/",
  "src/core/auth/",
  "src/core/permissions/",
  "src/core/entitlements/",
  "src/core/supabase/",
  "src/app/api/",
  "src/lib/actions/",
  "src/core/jobs/",
  "src/core/notifications/",
  "src/core/public-api/",
  "src/types/database",
];

function classify(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (PRESENTATION_ALLOWLIST.has(normalized)) return "presentation";
  if (ALLOWED_PREFIXES.some((p) => normalized === p || normalized.startsWith(p))) {
    return "allowed";
  }
  if (FORBIDDEN_PREFIXES.some((p) => normalized.startsWith(p))) return "forbidden";
  if (normalized.startsWith("src/features/")) return "forbidden";
  return "unrelated";
}

function listFromGit() {
  const out = execSync("git diff --name-only HEAD && git diff --name-only --cached && git ls-files --others --exclude-standard", {
    cwd: root,
    encoding: "utf8",
  });
  return [...new Set(out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
}

function parseArgs(argv) {
  const filesIdx = argv.indexOf("--files");
  const themeOnly = argv.includes("--theme-only");
  let files = null;
  if (filesIdx >= 0) {
    files = (argv[filesIdx + 1] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return { files, themeOnly };
}

const { files: explicit, themeOnly } = parseArgs(process.argv.slice(2));
const files = explicit ?? listFromGit();
const classified = files.map((f) => ({ file: f, kind: classify(f) }));

const themeRelated = classified.filter((c) => c.kind === "allowed" || c.kind === "presentation");
const forbidden = classified.filter((c) => c.kind === "forbidden");
const unrelated = classified.filter((c) => c.kind === "unrelated");

console.log(`A11y theme scope check — ${files.length} path(s)`);
console.log(`  theme/presentation: ${themeRelated.length}`);
console.log(`  forbidden:          ${forbidden.length}`);
console.log(`  unrelated WIP:      ${unrelated.length}`);

if (themeOnly) {
  if (themeRelated.length === 0) {
    console.log("No theme files in diff; OK.");
    process.exit(0);
  }
  if (forbidden.length > 0) {
    console.error("\nFORBIDDEN paths mixed with theme/a11y work (brief §14):");
    for (const f of forbidden) console.error(`  - ${f.file}`);
    console.error(
      "\nDo NOT modify Supabase, auth, permissions, entitlements, API, actions, or clinical logic in a theme commit."
    );
    process.exit(1);
  }
  if (unrelated.length > 0) {
    console.warn(
      `\nWarning: ${unrelated.length} unrelated path(s) in the working tree. Commit theme files alone.`
    );
  }
  console.log("Theme scope OK (no forbidden paths alongside theme changes).");
  process.exit(0);
}

// Strict mode: any forbidden path fails (use when staging a pure theme commit)
if (forbidden.length > 0) {
  console.error("\nFORBIDDEN paths for theme/a11y scope:");
  for (const f of forbidden) console.error(`  - ${f.file}`);
  console.error("\nTip: use --theme-only to ignore unrelated WIP and only fail on mixed forbidden+theme.");
  process.exit(1);
}

console.log("Scope OK — no forbidden paths.");
process.exit(0);
