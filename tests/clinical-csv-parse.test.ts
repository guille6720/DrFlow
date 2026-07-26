import { describe, it, expect } from "vitest";
import { parseClinicalCsvContent, parseCsvRows } from "@/lib/utils/clinical-csv-parse";

describe("parseCsvRows", () => {
  it("parses quoted commas", () => {
    const rows = parseCsvRows('a,b\n"1,2",3\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["1,2", "3"],
    ]);
  });
});

describe("parseClinicalCsvContent", () => {
  it("maps Spanish headers to clinical rows", () => {
    const csv = `documento_dni,apellido,nombre,fecha_consulta,motivo,evolucion
3736532,Ludeña,Delicia,30/06/2026,Control,Estable
`;
    const { rows, errors } = parseClinicalCsvContent(csv, 100);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].document_number).toBe("3736532");
    expect(rows[0].consultation_date).toBe("2026-06-30");
    expect(rows[0].chief_complaint).toContain("Control");
  });

  it("requires dni column", () => {
    const { rows, errors } = parseClinicalCsvContent("nombre,apellido\nJuan,Perez\n", 10);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/documento_dni/i);
  });
});
