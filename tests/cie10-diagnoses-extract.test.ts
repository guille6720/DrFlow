import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("CIE-10 diagnosis extract", () => {
  const jsonPath = resolve(process.cwd(), "data/lista-tabular-enfermedades.normalized.json");
  const reportPath = resolve(process.cwd(), "data/lista-tabular-enfermedades.validation-report.json");

  it("has normalized JSON with expected volume and no duplicate codes", () => {
    const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
    const diagnoses = payload.diagnoses as Array<{ code: string; name: string }>;
    expect(diagnoses.length).toBeGreaterThanOrEqual(600);
    expect(diagnoses.length).toBeLessThan(2000);
    const codes = diagnoses.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(diagnoses.every((d) => d.code && d.name.trim().length >= 2)).toBe(true);
  });

  it("validation report marks sample checks as clean", () => {
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    expect(report.valid_diagnoses).toBeGreaterThanOrEqual(600);
    expect(report.empty_descriptions).toBe(0);
    expect(report.duplicates).toBe(0);
    const fails = (report.sample_validation as Array<{ fail: number }>).reduce(
      (n, c) => n + c.fail,
      0
    );
    expect(fails).toBe(0);
  });

  it("keeps known CIE-10 rows intact", () => {
    const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
    const byCode = new Map(
      (payload.diagnoses as Array<{ code: string; name: string }>).map((d) => [d.code, d.name])
    );
    expect(byCode.get("A00.0")).toMatch(/Cólera/i);
    expect(byCode.get("J02.0")).toMatch(/Faringitis/i);
    expect(byCode.get("U07.0")).toMatch(/vapeo/i);
    expect(byCode.get("F01.A")).toMatch(/Demencia vascular/i);
  });
});
