import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { CRITICAL_COVERAGE } from "../tests/coverage-scope";

const root = process.cwd();

describe("enterprise quality gate infrastructure", () => {
  it("includes all required documentation", () => {
    const docs = [
      "QUALITY_AUDIT.md",
      "QUALITY_REPORT.md",
      "SECURITY_GATE.md",
      "docs/DEFINITION_OF_DONE.md",
      "docs/ENGINEERING_STANDARDS.md",
      ".github/pull_request_template.md",
    ];
    for (const doc of docs) {
      expect(existsSync(resolve(root, doc)), doc).toBe(true);
    }
  });

  it("includes all gate scripts", () => {
    const scripts = [
      "scripts/quality-gate.mjs",
      "scripts/code-quality-gate.mjs",
      "scripts/security-gate.mjs",
      "scripts/architecture-gate.mjs",
      "scripts/performance-gate.mjs",
      "scripts/check-critical-coverage.mjs",
      "scripts/critical-coverage-rules.mjs",
    ];
    for (const script of scripts) {
      expect(existsSync(resolve(root, script)), script).toBe(true);
    }
  });

  it("defines critical coverage rules for auth and clinical modules", () => {
    const ids = CRITICAL_COVERAGE.map((r) => r.id);
    expect(ids).toContain("permissions");
    expect(ids).toContain("auth-flow");
    expect(ids).toContain("patient-workflow");
    expect(ids).toContain("prescription-workflow");
    expect(ids).toContain("medical-record");
  });

  it("wires quality gates in CI workflow", () => {
    const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/quality-gate/);
    expect(ci).toMatch(/code-quality-gate/);
    expect(ci).toMatch(/security-gate/);
    expect(ci).toMatch(/architecture-gate/);
    expect(ci).toMatch(/check:critical-coverage/);
    expect(ci).toMatch(/performance:gate/);
  });

  it("configures husky pre-commit", () => {
    expect(existsSync(resolve(root, ".husky/pre-commit"))).toBe(true);
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.scripts.prepare).toBe("husky");
    expect(pkg["lint-staged"]).toBeDefined();
  });
});
