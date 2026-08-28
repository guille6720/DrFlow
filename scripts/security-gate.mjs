/**
 * Security gate — static patterns, RLS manifest, dependency audit.
 * Usage: node scripts/security-gate.mjs
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

import { failGate, passGate, readSource, rel, SRC_ROOT, walkDir } from "./lib/quality-scan.mjs";

const SECRET_PATTERNS = [
  { re: /sk_live_[a-zA-Z0-9]{10,}/, label: "Stripe live secret" },
  { re: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/, label: "JWT token literal" },
  { re: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']{20,}["']/, label: "Hardcoded service role" },
  { re: /CRON_SECRET\s*=\s*["'][^"']{8,}["']/, label: "Hardcoded CRON_SECRET" },
  { re: /CLINICAL_AI_LLM_API_KEY\s*=\s*["'][^"']{8,}["']/, label: "Hardcoded LLM API key" },
  { re: /OPENAI_API_KEY\s*=\s*["'][^"']{8,}["']/, label: "Hardcoded OpenAI API key" },
];

const SERVER_ONLY_MODULES = [
  "src/core/supabase/admin.ts",
  "src/core/env.server.ts",
  "src/lib/utils/clinical-ai-llm-provider.server.ts",
];

const DANGEROUS_PATTERNS = [
  { re: /dangerouslySetInnerHTML/, label: "dangerouslySetInnerHTML" },
  { re: /\beval\s*\(/, label: "eval()" },
  { re: /\.innerHTML\s*=/, label: "innerHTML assignment" },
];

const ALLOW_DANGEROUS = [
  "src/core/components/theme/ui-theme-bootstrap-script.tsx",
  "src/core/components/seo/marketing-json-ld.tsx",
  "src/core/components/landing/marketing-theme-script.tsx",
  // Static compile-time SVG illustrations — no user/PHI input (superadmin manual only).
  "src/core/components/superadmin/manual/manual-image.tsx",
];

function isUiComponentPath(r) {
  return (
    r.startsWith("src/components/ui/") ||
    r.startsWith("src/core/components/") ||
    (r.startsWith("src/features/") && r.includes("/components/") && r.endsWith(".tsx"))
  );
}

function scanSourceFiles() {
  const violations = [];
  for (const filePath of walkDir(SRC_ROOT)) {
    const r = rel(filePath);
    if (r.includes(".test.") || r.includes("__tests__")) continue;
    const content = readSource(filePath);

    for (const { re, label } of SECRET_PATTERNS) {
      if (re.test(content)) violations.push(`${r} — possible ${label}`);
    }

    if (!ALLOW_DANGEROUS.includes(r) && r !== "src/core/compliance/testing-campaign.ts") {
      for (const { re, label } of DANGEROUS_PATTERNS) {
        if (re.test(content)) violations.push(`${r} — ${label}`);
      }
    }

    if (isUiComponentPath(r) && /createAdminClient|SUPABASE_SERVICE_ROLE/.test(content)) {
      violations.push(`${r} — service role usage in UI component`);
    }

    if (
      isUiComponentPath(r) &&
      /\.from\s*\(\s*["'][a-z_]+["']\s*\)\.(insert|update|delete|upsert)/.test(content)
    ) {
      violations.push(`${r} — direct Supabase mutation in UI component`);
    }
  }
  return violations;
}

function checkServerOnlyModules() {
  const violations = [];
  for (const relPath of SERVER_ONLY_MODULES) {
    const filePath = resolve(SRC_ROOT, relPath.replace(/^src\//, ""));
    if (!existsSync(filePath)) {
      violations.push(`${relPath} — missing server-only module`);
      continue;
    }
    const content = readSource(filePath);
    if (!content.includes('import "server-only"')) {
      violations.push(`${relPath} — must import "server-only"`);
    }
  }
  return violations;
}

function checkRlsManifest() {
  const manifest = resolve(SRC_ROOT, "core/security/rls-manifest.ts");
  if (!existsSync(manifest)) {
    return ["src/core/security/rls-manifest.ts missing"];
  }
  const content = readSource(manifest);
  if (!content.includes("TABLES_REQUIRING_RLS")) {
    return ["RLS manifest incomplete — TABLES_REQUIRING_RLS missing"];
  }
  return [];
}

/** Known production dependency advisories — tracked in SECURITY_GATE.md until remediated. */
const AUDIT_ALLOWLIST = new Set(["xlsx", "sharp"]);

function runNpmAudit() {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["audit", "--omit=dev", "--json"],
    { encoding: "utf8", shell: process.platform === "win32" }
  );

  let report;
  try {
    report = JSON.parse(result.stdout || "{}");
  } catch {
    return ["npm audit returned invalid JSON"];
  }

  const violations = [];
  for (const [name, advisory] of Object.entries(report.advisories ?? {})) {
    const pkg = advisory.name ?? name;
    const severity = advisory.severity ?? "unknown";
    if (AUDIT_ALLOWLIST.has(pkg)) continue;
    if (severity === "high" || severity === "critical" || severity === "moderate") {
      violations.push(`${pkg} — ${severity}: ${advisory.title ?? "advisory"}`);
    }
  }

  if (violations.length) {
    return [`npm audit reported unallowlisted vulnerabilities:`, ...violations];
  }

  const allowlisted = [...AUDIT_ALLOWLIST].filter((pkg) =>
    Object.values(report.advisories ?? {}).some((a) => a.name === pkg)
  );
  if (allowlisted.length) {
    console.log(`   ℹ Allowlisted advisories: ${allowlisted.join(", ")}`);
  }

  return [];
}

function main() {
  console.log("\n🔒 DrFlow — Security gate\n");

  const violations = [
    ...scanSourceFiles(),
    ...checkServerOnlyModules(),
    ...checkRlsManifest(),
    ...runNpmAudit(),
  ];

  if (violations.length) {
    failGate("Security gate failed", violations);
  }

  passGate("Security gate OK", ["RLS manifest present", "npm audit clean (high+)"]);
}

main();
