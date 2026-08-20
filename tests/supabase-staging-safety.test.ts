import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("supabase staging safety scripts", () => {
  it("shared refs distinguish staging and production", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/supabase-project-refs.mjs"),
      "utf8"
    );
    expect(source).toContain('STAGING_REF = "gprmsufvhabntbrytwyi"');
    expect(source).toContain('PRODUCTION_REF = "nipqdarduknydqptqzup"');
    expect(source).toContain("assertLinkedStagingOrExit");
  });

  it("dry-run script always uses --dry-run and staging ref", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/supabase-db-push-dry-run-staging.mjs"),
      "utf8"
    );
    expect(source).toContain('"--dry-run"');
    expect(source).toContain("STAGING_REF");
    expect(source).toContain("assertLinkedStagingOrExit");
  });

  it("real staging push requires dual confirmation env vars", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/supabase-db-push-staging.mjs"),
      "utf8"
    );
    expect(source).toContain("ALLOW_STAGING_DB_PUSH");
    expect(source).toContain("CONFIRM_STAGING_DB_PUSH");
    expect(source).not.toContain('"--dry-run"');
    expect(source).toContain("STAGING_REF");
  });

  it("preflight exits 0 when linked to staging", () => {
    const script = resolve(process.cwd(), "scripts/supabase-preflight-staging.mjs");
    const output = execFileSync(process.execPath, [script], {
      encoding: "utf8",
      cwd: process.cwd(),
    });
    expect(output).toMatch(/gprmsufvhabntbrytwyi/);
    expect(output).toMatch(/staging gate passed/i);
  });
});
