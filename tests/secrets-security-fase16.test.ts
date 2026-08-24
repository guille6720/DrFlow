import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  evaluateSecretsSecurityPosture,
  scanContentForSecretLeaks,
  SECRET_CREDENTIAL_CATALOG,
  SECRET_LEAK_SCAN_PATTERNS,
  SERVER_ONLY_SECRET_MODULES,
} from "@/core/compliance/secrets-security";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const TRACKED_SCAN_ROOTS = ["src", "docs", "scripts", "supabase", "tests"] as const;

const TRACKED_SCAN_FILES = [".env.example", "next.config.ts", "vercel.json"] as const;

const SCAN_SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  "coverage",
  "qa-exports",
  "test-results",
  "playwright-report",
]);

const SCAN_SKIP_FILE_RE =
  /\.(png|jpg|jpeg|gif|webp|ico|woff2?|pdf|zip|xlsx|csv|snap|lock)$/i;

function walkScanFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SCAN_SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkScanFiles(full, out);
      continue;
    }
    if (SCAN_SKIP_FILE_RE.test(entry)) continue;
    if (entry === ".env.local" || entry.startsWith(".env.") && entry !== ".env.example") continue;
    out.push(full);
  }
  return out;
}

function collectTrackedScanTargets(): string[] {
  const files: string[] = [];
  for (const root of TRACKED_SCAN_ROOTS) {
    const abs = resolve(ROOT, root);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (st.isDirectory()) {
      walkScanFiles(abs, files);
    } else {
      files.push(abs);
    }
  }
  for (const rel of TRACKED_SCAN_FILES) {
    const abs = resolve(ROOT, rel);
    if (existsSync(abs)) files.push(abs);
  }
  return [...new Set(files)];
}

describe("secrets-security policy module", () => {
  it("catalogs credential classes required by PHASE 16", () => {
    const classes = SECRET_CREDENTIAL_CATALOG.map((c) => c.class);
    expect(classes).toEqual(
      expect.arrayContaining([
        "supabase_service_role",
        "mercado_pago",
        "google_vertex_gemini",
        "cron_secret",
        "database_url",
        "private_certificate",
      ])
    );
    const serviceRole = SECRET_CREDENTIAL_CATALOG.find((c) => c.class === "supabase_service_role");
    expect(serviceRole?.serverOnly).toBe(true);
    expect(serviceRole?.rotationRequiredOnLeak).toBe(true);
  });

  it("defines leak scan patterns without exposing values", () => {
    expect(SECRET_LEAK_SCAN_PATTERNS.length).toBeGreaterThanOrEqual(6);
    for (const rule of SECRET_LEAK_SCAN_PATTERNS) {
      expect(rule.id).toBeTruthy();
      expect(rule.credentialClass).toBeTruthy();
    }
  });

  it("detects obvious hardcoded assignment patterns", () => {
    const fixture = ["SUPABASE_SERVICE_ROLE", "_KEY=", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def"].join(
      ""
    );
    const findings = scanContentForSecretLeaks(fixture, "fixture.env");
    expect(findings.some((f) => f.patternId === "hardcoded_service_role")).toBe(true);
  });

  it("evaluateSecretsSecurityPosture flags rotation when leaks exist", () => {
    const clean = evaluateSecretsSecurityPosture({
      trackedLeakCount: 0,
      leakClasses: [],
      envGitignored: true,
      envExampleClean: true,
    });
    expect(clean.rotationBanner).toBeNull();

    const dirty = evaluateSecretsSecurityPosture({
      trackedLeakCount: 1,
      leakClasses: ["mercado_pago"],
      envGitignored: true,
      envExampleClean: true,
    });
    expect(dirty.rotationBanner).toBe("ROTACIÓN DE CREDENCIALES REQUERIDA");
  });
});

describe("tracked repository secret scan (Phase 16)", () => {
  const files = collectTrackedScanTargets();
  const allFindings = files.flatMap((abs) => {
    const rel = abs.replace(ROOT, "").replace(/^\\/, "").replace(/\\/g, "/");
    const content = readFileSync(abs, "utf8");
    return scanContentForSecretLeaks(content, rel, { allowJwtPlaceholder: true });
  });

  it("scans a representative set of versioned files", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("has no hardcoded secrets in tracked source/docs/scripts", () => {
    if (allFindings.length > 0) {
      const summary = allFindings
        .map((f) => `${f.file} → ${f.patternId} (${f.credentialClass})`)
        .join("\n");
      expect.fail(`ROTACIÓN DE CREDENCIALES REQUERIDA\n${summary}`);
    }
    expect(allFindings).toEqual([]);
  });
});

describe("Phase 16 env and module hygiene", () => {
  it(".env.local is gitignored", () => {
    const gitignore = read(".gitignore");
    expect(gitignore).toMatch(/\.env\*/);
  });

  it(".env.example keeps empty secret placeholders", () => {
    const example = read(".env.example");
    expect(example).toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(example).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY=eyJ/);
    expect(example).not.toMatch(/MP_ACCESS_TOKEN=[^#\n]{8,}/);
    expect(example).not.toMatch(/CRON_SECRET=[^#\n]{8,}/);
  });

  it("server-only secret modules import server-only", () => {
    for (const rel of SERVER_ONLY_SECRET_MODULES) {
      const content = read(rel);
      expect(content).toContain('import "server-only"');
      expect(content).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']{20,}["']/);
    }
  });

  it("admin client never imported from UI components", () => {
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (!SCAN_SKIP_DIR_NAMES.has(entry)) walk(full);
          continue;
        }
        if (!entry.endsWith(".tsx")) continue;
        const rel = full.replace(ROOT, "").replace(/^\\/, "").replace(/\\/g, "/");
        const isUi =
          rel.includes("/components/") || rel.startsWith("src/app/") || rel.includes("/features/");
        if (!isUi) continue;
        const content = readFileSync(full, "utf8");
        if (/createAdminClient|SUPABASE_SERVICE_ROLE_KEY/.test(content)) {
          offenders.push(rel);
        }
      }
    }
    walk(resolve(ROOT, "src"));
    expect(offenders).toEqual([]);
  });

  it("public health probe omits service role metadata", async () => {
    const { getPublicHealthStatus } = await import("@/core/observability/health");
    const status = await getPublicHealthStatus();
    expect(status.checks).not.toHaveProperty("serviceRole");
  });

  it("security-gate script defines secret patterns", () => {
    const gate = read("scripts/security-gate.mjs");
    expect(gate).toContain("SECRET_PATTERNS");
    expect(gate).toContain("Hardcoded service role");
  });
});
