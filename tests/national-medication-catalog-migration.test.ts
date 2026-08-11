import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/107_national_medication_catalog.sql"),
  "utf8"
);

describe("107_national_medication_catalog migration", () => {
  it("creates national_medications and unified search RPC", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS national_medications/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION search_medication_catalog/);
    expect(sql).toMatch(/FROM pami_vademecum v/);
    expect(sql).toMatch(/FROM national_medications n/);
  });
});
