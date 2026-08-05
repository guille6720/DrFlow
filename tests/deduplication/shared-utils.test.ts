import { describe, expect, it } from "vitest";
import { formatPatientName } from "@/shared/utils/patient-display";
import { unwrapJoin } from "@/core/supabase/unwrap-join";
import { formatCurrency, formatCurrencyAr } from "@/shared/utils/currency";

describe("shared deduplication utilities", () => {
  it("formatPatientName handles array join", () => {
    expect(formatPatientName([{ first_name: "Ana", last_name: "García" }])).toBe("García, Ana");
    expect(formatPatientName(null, "Sin paciente")).toBe("Sin paciente");
  });

  it("unwrapJoin unwraps PostgREST relations", () => {
    expect(unwrapJoin({ id: "1" })).toEqual({ id: "1" });
    expect(unwrapJoin([{ id: "2" }])).toEqual({ id: "2" });
    expect(unwrapJoin(null)).toBeNull();
  });

  it("currency formatters produce ARS strings", () => {
    expect(formatCurrencyAr(1500)).toContain("1.500");
    expect(formatCurrency(1500)).toMatch(/1500|1\.500/);
  });
});
