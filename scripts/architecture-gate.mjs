/**
 * Architecture gate — component size, UI/service separation.
 * Usage: node scripts/architecture-gate.mjs
 */
import { walkDir, rel, readSource, lineCount, failGate, passGate, SRC_ROOT } from "./lib/quality-scan.mjs";

const MAX_COMPONENT_LINES = 350;
const WARN_COMPONENT_LINES = 250;
const COMPONENTS_DIR = `${SRC_ROOT}/components`;

function scanComponents() {
  const violations = [];
  const warnings = [];

  for (const filePath of walkDir(COMPONENTS_DIR)) {
    if (!filePath.endsWith(".tsx")) continue;
    const r = rel(filePath);
    const lines = lineCount(filePath);
    const content = readSource(filePath);

    if (lines > MAX_COMPONENT_LINES) {
      violations.push(`${r} — ${lines} lines (max ${MAX_COMPONENT_LINES})`);
    } else if (lines > WARN_COMPONENT_LINES) {
      warnings.push(`${r} — ${lines} lines (target ≤${WARN_COMPONENT_LINES})`);
    }

    if (/export async function/.test(content) && /^["']use client["']/.test(content.trimStart())) {
      violations.push(`${r} — async server function in client UI component file`);
    }
  }

  return { violations, warnings };
}

function scanBusinessLogicInUi() {
  const violations = [];
  const uiDirs = [`${SRC_ROOT}/components`];

  for (const dir of uiDirs) {
    for (const filePath of walkDir(dir)) {
      if (!filePath.endsWith(".tsx")) continue;
      const r = rel(filePath);
      const content = readSource(filePath);

      if (/createAdminClient\s*\(/.test(content)) {
        violations.push(`${r} — admin client in UI (move to lib/actions or lib/server)`);
      }

      if (/\.rpc\s*\(\s*["'][a-z_]+["']/.test(content) && !r.includes("-client.tsx")) {
        violations.push(`${r} — RPC call in UI component (use server action or hook)`);
      }
    }
  }

  return violations;
}

function main() {
  console.log("\n🏗 DrFlow — Architecture gate\n");

  const { violations: sizeViolations, warnings } = scanComponents();
  const logicViolations = scanBusinessLogicInUi();
  const violations = [...sizeViolations, ...logicViolations];

  if (warnings.length) {
    console.log("⚠ Large components (refactor recommended):");
    for (const w of warnings) console.log(`   ${w}`);
    console.log("");
  }

  if (violations.length) {
    failGate("Architecture gate failed", violations);
  }

  passGate("Architecture gate OK", [
    `Component max ${MAX_COMPONENT_LINES} lines enforced`,
    `${warnings.length} component(s) above ${WARN_COMPONENT_LINES} lines (warning only)`,
  ]);
}

main();
