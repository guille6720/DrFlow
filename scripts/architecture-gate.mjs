/**
 * Architecture gate — component size, UI/service separation.
 * Usage: node scripts/architecture-gate.mjs
 */
import { existsSync } from "fs";
import { sep } from "path";

import { failGate, lineCount, passGate, readSource, rel, SRC_ROOT, walkComponentFiles, walkDir } from "./lib/quality-scan.mjs";

const MAX_COMPONENT_LINES = 350;
const WARN_COMPONENT_LINES = 200;
const STABILIZATION_COMPONENT_LINES = 200;

/** Pre-approved legacy monoliths — split tracked in stabilization backlog (PROMPT 10). */
const COMPONENT_SIZE_ALLOWLIST = new Set([
  "src/core/components/landing/drflow-home-landing.tsx",
  "src/features/pacientes/components/pacientes/patient-search-combobox.tsx",
  "src/features/turnos/components/turnos-nuevo-wizard.tsx",
]);

function scanComponents() {
  const violations = [];
  const warnings = [];

  for (const filePath of walkComponentFiles(".tsx")) {
    const r = rel(filePath);
    const lines = lineCount(filePath);
    const content = readSource(filePath);

    if (lines > MAX_COMPONENT_LINES) {
      if (COMPONENT_SIZE_ALLOWLIST.has(r)) {
        warnings.push(
          `${r} — ${lines} lines (allowlisted legacy monolith; target ≤${MAX_COMPONENT_LINES})`
        );
      } else {
        violations.push(`${r} — ${lines} lines (max ${MAX_COMPONENT_LINES})`);
      }
    } else if (lines > WARN_COMPONENT_LINES) {
      warnings.push(`${r} — ${lines} lines (stabilization target ≤${STABILIZATION_COMPONENT_LINES})`);
    }

    if (/export async function/.test(content) && /^["']use client["']/.test(content.trimStart())) {
      violations.push(`${r} — async server function in client UI component file`);
    }

    const isClient = /^["']use client["']/.test(content.trimStart());
    if (isClient) {
      if (/@\/lib\/supabase\/server/.test(content)) {
        violations.push(`${r} — server Supabase client imported in client component`);
      }
      if (/createAdminClient\s*\(/.test(content)) {
        violations.push(`${r} — admin client in client UI (move to lib/actions or lib/server)`);
      }
    }

    if (
      (r.startsWith("src/components/ui/") ||
        r.startsWith("src/core/components/") ||
        r.startsWith("src/features/")) &&
      /\.from\s*\([^)]+\)\s*\.\s*(insert|update|delete|upsert)\s*\(/.test(content)
    ) {
      violations.push(`${r} — Supabase mutation in UI component (use server action)`);
    }
  }

  return { violations, warnings };
}

function scanBusinessLogicInUi() {
  const violations = [];

  for (const filePath of walkComponentFiles(".tsx")) {
    const r = rel(filePath);
    const content = readSource(filePath);

      if (/createAdminClient\s*\(/.test(content) && !/^["']use client["']/.test(content.trimStart())) {
        violations.push(`${r} — admin client in UI (move to lib/actions or lib/server)`);
      }

      if (/\.rpc\s*\(\s*["'][a-z_]+["']/.test(content) && !r.includes("-client.tsx")) {
        violations.push(`${r} — RPC call in UI component (use server action or hook)`);
      }
  }

  return violations;
}

function scanHooks() {
  const violations = [];
  const warnings = [];
  const hookDirs = [
    `${SRC_ROOT}/lib/hooks`,
    `${SRC_ROOT}/core/hooks`,
  ];
  for (const featureDir of walkDir(`${SRC_ROOT}/features`)) {
    if (featureDir.endsWith(`${sep}hooks`)) hookDirs.push(featureDir);
  }
  const HOOK_STABILIZATION_MAX = 150;
  const HOOK_HARD_MAX = 280;

  for (const hooksDir of hookDirs) {
    if (!existsSync(hooksDir)) continue;
    for (const filePath of walkDir(hooksDir)) {
      if (!filePath.endsWith(".ts")) continue;
      const r = rel(filePath);
      const content = readSource(filePath);
      if (content.startsWith("/** @deprecated")) continue;
      const lines = lineCount(filePath);

      if (lines > HOOK_HARD_MAX) {
        violations.push(`${r} — ${lines} lines (hook max ${HOOK_HARD_MAX} — split by concern)`);
      } else if (lines > HOOK_STABILIZATION_MAX) {
        warnings.push(`${r} — ${lines} lines (stabilization target ≤${HOOK_STABILIZATION_MAX})`);
      }

      if (/@\/(lib|core)\/supabase\/server/.test(content)) {
        violations.push(`${r} — server Supabase client in client hook`);
      }
    }
  }

  return { violations, warnings };
}

function main() {
  console.log("\n🏗 DrFlow — Architecture gate\n");

  const { violations: sizeViolations, warnings } = scanComponents();
  const logicViolations = scanBusinessLogicInUi();
  const { violations: hookViolations, warnings: hookWarnings } = scanHooks();
  const violations = [...sizeViolations, ...logicViolations, ...hookViolations];
  const allWarnings = [...warnings, ...hookWarnings];

  if (allWarnings.length) {
    console.log("⚠ Stabilization debt (refactor recommended):");
    for (const w of allWarnings) console.log(`   ${w}`);
    console.log("");
  }

  if (violations.length) {
    failGate("Architecture gate failed", violations);
  }

  passGate("Architecture gate OK", [
    `Component max ${MAX_COMPONENT_LINES} lines enforced`,
    `Hook max 280 lines enforced`,
    `${allWarnings.length} file(s) above stabilization targets (200/150 lines)`,
  ]);
}

main();
