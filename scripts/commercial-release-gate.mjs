/**
 * Commercial release gate — Phase 25.
 * Fails (exit 1) when technical BLOCKER suites fail or required signals are missing.
 * External legal/accounting items are reported but do not fail this script.
 *
 * Usage: node scripts/commercial-release-gate.mjs
 *        npm run commercial:gate
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = process.cwd();

const REQUIRED_TEST_FILES = [
  "tests/tenant-isolation-fase10.test.ts",
  "tests/rls-policies.test.ts",
  "tests/secrets-security-fase16.test.ts",
  "tests/sanitize-clinical-ai-input.test.ts",
  "tests/clinical-ai-failsafe.test.ts",
  "tests/monetization-security-fase19.test.ts",
  "tests/audit-log-security-fase9.test.ts",
  "tests/storage-security-fase14.test.ts",
];

const SIGNAL_CHECKS = [
  {
    id: "cross_tenant",
    file: "src/core/compliance/tenant-isolation.ts",
    alt: ["tests/tenant-isolation-fase10.test.ts"],
    mustInclude: null,
  },
  {
    id: "rls_manifest",
    file: "src/core/security/rls-manifest.ts",
    mustInclude: "TABLES_REQUIRING_RLS",
  },
  {
    id: "ai_sanitize",
    file: "src/lib/ai/sanitize-clinical-ai-input.ts",
    mustInclude: "sanitizeClinicalAIInput",
  },
  {
    id: "payment_catalog",
    file: "src/core/compliance/monetization-security.ts",
    mustInclude: "assertApprovedPaymentMatchesCatalog",
  },
  {
    id: "audit_immutable",
    file: "supabase/migrations/055_immutable_audit_logging.sql",
    alt: [
      "supabase/migrations/048_audit_phase12.sql",
      "supabase/migrations/132_audit_log_security.sql",
    ],
    mustInclude: "prevent_audit_mutation",
  },
  {
    id: "storage_private",
    file: "supabase/migrations/136_storage_security.sql",
    mustInclude: "public = false",
  },
  {
    id: "secrets_module",
    file: "src/core/compliance/secrets-security.ts",
    mustInclude: "SECRET_CREDENTIAL_CATALOG",
  },
];

const EXTERNAL_ACTIONS = [
  "Revisión abogado docs/legal/*",
  "Facturación ARCA — REQUIERE CONTADOR",
  "Registro AAIP — GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO",
  "DPA subprocesadores internacionales",
  "Homologación REFEPS (si se vende validez oficial)",
];

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function fileExists(rel) {
  return existsSync(resolve(ROOT, rel));
}

function checkSignals() {
  const failures = [];
  for (const check of SIGNAL_CHECKS) {
    const candidates = [check.file, ...(check.alt || [])];
    const found = candidates.find((p) => fileExists(p));
    if (!found) {
      failures.push(`BLOCKER signal missing: ${check.id} (${candidates.join(" | ")})`);
      continue;
    }
    if (check.mustInclude) {
      const content = read(found);
      if (!content.includes(check.mustInclude)) {
        failures.push(
          `BLOCKER signal incomplete: ${check.id} — expected "${check.mustInclude}" in ${found}`
        );
      }
    }
  }
  return failures;
}

function checkTestFilesPresent() {
  const failures = [];
  for (const rel of REQUIRED_TEST_FILES) {
    if (!fileExists(rel)) {
      failures.push(`BLOCKER test suite missing: ${rel}`);
    }
  }
  return failures;
}

function runVitestSuites() {
  console.log("\n▶ Running commercial BLOCKER vitest suites…\n");
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vitest", "run", ...REQUIRED_TEST_FILES],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    }
  );
  return (result.status ?? 1) === 0;
}

function main() {
  console.log("\n🏁 DrFlow — Commercial Release Gate (Fase 25)\n");
  console.log("Categories: PASS | WARNING | BLOCKER | EXTERNAL ACTION REQUIRED\n");

  const failures = [...checkTestFilesPresent(), ...checkSignals()];

  if (failures.length) {
    console.error("Static BLOCKER checks failed:\n");
    for (const f of failures) console.error(`  • ${f}`);
    console.error("\n❌ Commercial release gate FAILED (static)\n");
    process.exit(1);
  }

  console.log("✅ Static BLOCKER signals present\n");

  const testsOk = runVitestSuites();
  if (!testsOk) {
    console.error("\n❌ Commercial release gate FAILED (BLOCKER tests)\n");
    console.error(
      "Commercialization blocked: cross-tenant / RLS / secrets / AI PHI / payments / audit / storage.\n"
    );
    process.exit(1);
  }

  console.log("\n—— EXTERNAL ACTION REQUIRED (do not fail this script) ——\n");
  for (const item of EXTERNAL_ACTIONS) {
    console.log(`  • ${item}`);
  }

  console.log("\n✅ Commercial release gate PASSED (technical BLOCKERs clear)");
  console.log("   Legal/AAIP/ARCA remain EXTERNAL ACTION REQUIRED — see docs/compliance/MONETIZATION-GATE.md\n");
  process.exit(0);
}

main();
