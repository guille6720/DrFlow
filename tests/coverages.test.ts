import { describe, expect, it } from "vitest";

import {
  coverageOptionsForClinic,
  defaultInsurancePlanForProvider,
  insuranceNumberLabel,
  insurancePlanOptionsForProvider,
  insuranceProviderOptions,
  normalizeCoverages,
  resolveDefaultCoverage,
  STANDARD_COVERAGES,
} from "@/lib/constants/coverages";

describe("coverages helpers", () => {
  it("normalizes and dedupes coverages", () => {
    expect(normalizeCoverages([" OSDE ", "osde", "Particular", ""])).toEqual([
      "OSDE",
      "Particular",
    ]);
  });

  it("labels insurance number by coverage", () => {
    expect(insuranceNumberLabel("PAMI")).toBe("N° beneficio PAMI");
    expect(insuranceNumberLabel("OSDE")).toBe("N° afiliado");
  });

  it("falls back to standard list when clinic has none", () => {
    expect(coverageOptionsForClinic([])).toEqual([...STANDARD_COVERAGES]);
    expect(coverageOptionsForClinic(["OSDE", "OSECAC"])).toEqual(["OSDE", "OSECAC"]);
  });

  it("resolves default without forcing PAMI", () => {
    expect(resolveDefaultCoverage(null, ["OSDE", "Particular"])).toBe("OSDE");
    expect(resolveDefaultCoverage("Particular", ["OSDE", "Particular"])).toBe("Particular");
    expect(resolveDefaultCoverage("PAMI", ["OSDE"], "OSDE")).toBe("OSDE");
  });

  it("lists common insurance providers for turnos", () => {
    expect(insuranceProviderOptions()).toContain("PAMI");
    expect(insuranceProviderOptions()).toContain("OSDE");
    expect(insuranceProviderOptions("Otra prepaga")).toContain("Otra prepaga");
  });

  it("returns plans per provider and keeps custom plan", () => {
    expect(insurancePlanOptionsForProvider("OSDE")).toContain("310");
    expect(insurancePlanOptionsForProvider("PAMI")).toContain("PMO");
    expect(insurancePlanOptionsForProvider("OSDE", "Plan corporativo")).toContain(
      "Plan corporativo"
    );
    expect(defaultInsurancePlanForProvider("OSDE")).toBe("210");
  });
});
