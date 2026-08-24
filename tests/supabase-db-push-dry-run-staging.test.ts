import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("supabase-db-push-dry-run-staging", () => {
  const source = readFileSync(
    resolve(process.cwd(), "scripts/supabase-db-push-dry-run-staging.mjs"),
    "utf8"
  );

  it("targets staging only and always uses --dry-run", () => {
    expect(source).toContain("STAGING_REF");
    expect(source).toContain("PRODUCTION_REF");
    expect(source).toContain('"--dry-run"');
    expect(source).toContain('"--project-ref"');
    expect(source).toContain("assertLinkedStagingOrExit");
  });
});
