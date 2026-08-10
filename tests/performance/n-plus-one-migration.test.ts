import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/089_n_plus_one_rpcs.sql"),
  "utf8"
);

describe("089_n_plus_one_rpcs migration", () => {
  it("defines pathology patient search RPC with clinic scope", () => {
    expect(sql).toMatch(/search_patient_ids_by_pathology/);
    expect(sql).toMatch(/cr\.clinic_id = p_clinic_id/);
    expect(sql).toMatch(/escape_ilike_pattern/);
  });

  it("uses SECURITY INVOKER for RLS", () => {
    expect(sql).toMatch(/SECURITY INVOKER/);
  });

  it("grants execute to authenticated", () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.search_patient_ids_by_pathology/);
  });
});
