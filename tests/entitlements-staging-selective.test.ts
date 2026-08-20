import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("entitlements-staging-selective", () => {
  const source = readFileSync(
    resolve(process.cwd(), "scripts/entitlements-staging-selective.mjs"),
    "utf8"
  );

  it("excludes 110-120 and only allows pending 121-128", () => {
    expect(source).toContain("121_commercial_entitlements.sql");
    expect(source).toContain("128_entitlement_trial_expire.sql");
    expect(source).toContain("FORBIDDEN_PENDING_PREFIXES");
    expect(source).toContain("110_");
    expect(source).toContain("120_");
    expect(source).toContain("ALLOW_ENTITLEMENTS_STAGING_PUSH");
    expect(source).toContain("CONFIRM_STAGING_PROJECT_REF");
    expect(source).toContain("--dry-run");
    expect(source).toContain("STAGING_REF");
    expect(source).toContain("assertPendingExactly121to128");
  });

  it("never calls migration repair as applied", () => {
    expect(source).not.toMatch(/migration\s+repair/);
    expect(source).not.toContain("nipqdarduknydqptqzup");
  });
});
