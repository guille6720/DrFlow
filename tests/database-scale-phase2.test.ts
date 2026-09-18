import { describe, expect, it } from "vitest";

import {
  CLINICAL_RECORD_INSERT_RETURN_COLUMNS,
  DATA_IMPORT_SESSION_COLUMNS,
} from "@/core/supabase/select-columns";

import { mapWithConcurrency } from "@/features/integraciones/lib/async-pool";

describe("database scale phase 2 helpers", () => {
  it("mapWithConcurrency preserves order with limited parallelism", async () => {
    const input = [1, 2, 3, 4, 5];
    const out = await mapWithConcurrency(input, 2, async (value) => value * 10);
    expect(out).toEqual([10, 20, 30, 40, 50]);
  });

  it("column lists for hot paths avoid wildcards", () => {
    expect(CLINICAL_RECORD_INSERT_RETURN_COLUMNS).not.toContain("*");
    expect(DATA_IMPORT_SESSION_COLUMNS).not.toContain("*");
    expect(DATA_IMPORT_SESSION_COLUMNS).toContain("clinic_id");
    expect(CLINICAL_RECORD_INSERT_RETURN_COLUMNS).toContain("patient_id");
  });
});
