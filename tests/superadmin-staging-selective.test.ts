import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("superadmin-staging-selective", () => {
  const source = readFileSync(
    resolve(process.cwd(), "scripts/superadmin-staging-selective.mjs"),
    "utf8"
  );

  it("allows only pending 129 and excludes 110-120", () => {
    expect(source).toContain("129_superadmin_commercial_control.sql");
    expect(source).toContain("ALLOWED_PENDING");
    expect(source).toContain("FORBIDDEN_PENDING_PREFIXES");
    expect(source).toContain("110_");
    expect(source).toContain("120_");
    expect(source).toContain("ALLOW_SUPERADMIN_STAGING_PUSH");
    expect(source).toContain("CONFIRM_STAGING_PROJECT_REF");
    expect(source).toContain("assertPendingExactly129");
    expect(source).toContain("STAGING_REF");
    expect(source).toContain("--dry-run");
  });

  it("never targets production or fakes migration history", () => {
    expect(source).not.toMatch(/migration\s+repair/);
    expect(source).toContain("PRODUCTION_REF");
    expect(source).toContain("STAGING_REF");
    expect(source).toContain("ALLOW_SUPERADMIN_STAGING_PUSH");
    expect(source).toMatch(/PRODUCTION_REF/);
  });
});
