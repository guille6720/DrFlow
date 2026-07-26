import { describe, it, expect } from "vitest";
import {
  parseHceExportCsv,
  hceRowToClinicalRecord,
  placeholderDniFromConsumerId,
  isHceExportCsv,
} from "@/lib/utils/hce-export-parse";

const SAMPLE = `paciente_id,apellido,nombre,dni,tipo_registro,fecha_inicio,fecha_fin,estado,diagnostico,cie10,notas
consumers/065ad986,Ludeña,Delicia,,diagnostics,2020-06-03T20:42:50.590Z,,chronic,Otro dolor cronico,r-522,
consumers/065ad986,Ludeña,Delicia,,records,,,,,,
`;

describe("parseHceExportCsv", () => {
  it("parses DrApp HCE header", () => {
    const { rows, errors } = parseHceExportCsv(SAMPLE, 100);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0].paciente_id).toBe("consumers/065ad986");
    expect(rows[0].diagnostico).toBe("Otro dolor cronico");
  });

  it("detects HCE export", () => {
    expect(isHceExportCsv(SAMPLE, "HCE_export.csv")).toBe(true);
  });

  it("maps diagnostic row to clinical record", () => {
    const { rows } = parseHceExportCsv(SAMPLE, 100);
    const rec = hceRowToClinicalRecord(rows[0]);
    expect(rec?.diagnosis).toContain("Otro dolor cronico");
    expect(hceRowToClinicalRecord(rows[1])).toBeNull();
  });

  it("placeholder dni is 8 digits", () => {
    expect(placeholderDniFromConsumerId("consumers/065ad986")).toMatch(/^\d{8}$/);
  });
});
