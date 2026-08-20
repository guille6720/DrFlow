import { execFileSync } from "child_process";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("verify-entitlement-migrations", () => {
  it("exits 0 and refuses to claim it applies migrations", () => {
    const script = resolve(process.cwd(), "scripts/verify-entitlement-migrations.mjs");
    const output = execFileSync(process.execPath, [script], {
      encoding: "utf8",
      cwd: process.cwd(),
    });
    expect(output).toMatch(/does NOT apply migrations/i);
    expect(output).toMatch(/121_commercial_entitlements\.sql/);
    expect(output).toMatch(/128_entitlement_trial_expire\.sql/);
    expect(output).toMatch(/gprmsufvhabntbrytwyi/);
    expect(output).toMatch(/nipqdarduknydqptqzup/);
  });
});
