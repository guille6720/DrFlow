import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/064_query_optimization.sql"),
  "utf8"
);

describe("064_query_optimization migration", () => {
  it("defines patient record count RPC", () => {
    expect(sql).toMatch(/count_clinical_records_by_patients/);
    expect(sql).toMatch(/GROUP BY cr\.patient_id/);
  });

  it("defines revenue aggregation RPCs", () => {
    expect(sql).toMatch(/sum_collected_cash_charges/);
    expect(sql).toMatch(/sum_paid_payments/);
  });

  it("grants execute to authenticated", () => {
    expect(sql.match(/GRANT EXECUTE/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
