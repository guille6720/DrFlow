import { describe, expect, it } from "vitest";

import {
  computeBmi,
  formatVitalsForEvolution,
  vitalsFormHasAnyValue,
} from "@/features/historias/utils/vitals-form";

describe("vitals-form", () => {
  it("computes BMI from weight and height", () => {
    expect(computeBmi("80", "180")).toBe("24.7");
    expect(computeBmi("", "180")).toBeNull();
  });

  it("formats only filled vitals", () => {
    const text = formatVitalsForEvolution({
      tas: "120",
      tad: "80",
      fc: "72",
      fr: "",
      temperature: "36.5",
      satO2: "98",
      weight: "80",
      height: "180",
      recordedAt: "",
    });
    expect(text).toContain("TA 120/80 mmHg");
    expect(text).toContain("FC 72 lpm");
    expect(text).toContain("T° 36.5 °C");
    expect(text).toContain("SatO2 98 %");
    expect(text).toContain("IMC 24.7");
    expect(text).not.toContain("FR");
  });

  it("detects empty vs partial forms", () => {
    expect(
      vitalsFormHasAnyValue({
        tas: "",
        tad: "",
        fc: "",
        fr: "",
        temperature: "",
        satO2: "",
        weight: "",
        height: "",
        recordedAt: "",
      })
    ).toBe(false);
    expect(
      vitalsFormHasAnyValue({
        tas: "120",
        tad: "",
        fc: "",
        fr: "",
        temperature: "",
        satO2: "",
        weight: "",
        height: "",
        recordedAt: "",
      })
    ).toBe(true);
  });
});

describe("drapp quick panel switching", () => {
  it("documents one-open-at-a-time contract in source", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src/features/historias/components/consultas/use-drapp-quick-panel.ts"),
      "utf8"
    );
    expect(source).toMatch(/window\.confirm/);
    expect(source).toMatch(/requestOpen/);
    expect(source).toMatch(/setOpenPanel\(next\)/);
  });
});

describe("create-quick-clinical-entry", () => {
  it("exports quick save helpers for diagnosis treatment vitals and full consulta", async () => {
    const mod = await import("@/features/historias/utils/create-quick-clinical-entry");
    expect(typeof mod.saveQuickDiagnosis).toBe("function");
    expect(typeof mod.saveQuickTreatment).toBe("function");
    expect(typeof mod.saveQuickVitals).toBe("function");
    expect(typeof mod.saveFullConsultation).toBe("function");
  });
});
