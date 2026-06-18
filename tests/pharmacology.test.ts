import { describe, it, expect } from "vitest";
import { SYMPTOM_RELEVANCE_HINT, TREATMENT_LINE_LABELS } from "@/types/pharmacology";

describe("Pharmacology types", () => {
  it("defines treatment line labels", () => {
    expect(TREATMENT_LINE_LABELS[1]).toBe("Primera línea");
    expect(TREATMENT_LINE_LABELS[2]).toBe("Segunda línea");
  });

  it("defines symptom relevance hints", () => {
    expect(SYMPTOM_RELEVANCE_HINT[3]).toBe("Muy sugestivo");
    expect(SYMPTOM_RELEVANCE_HINT[1]).toBe("Asociado");
  });
});

describe("Pharmacology permissions", () => {
  it("doctors can access pharmacology", async () => {
    const { hasPermission } = await import("@/lib/permissions/roles");
    expect(hasPermission("doctor", "viewPharmacology")).toBe(true);
    expect(hasPermission("secretary", "viewPharmacology")).toBe(false);
    expect(hasPermission("clinic_admin", "viewPharmacology")).toBe(true);
  });
});
