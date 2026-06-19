import { describe, it, expect } from "vitest";
import {
  extractPatientFromFileName,
  extractPatientFromPdfText,
  mergePatientExtract,
} from "@/lib/utils/pdf-patient-extract";

describe("extractPatientFromFileName", () => {
  it("parses APELLIDO_Nombre_DNI pattern", () => {
    const result = extractPatientFromFileName("GARCIA_Juan_30123456.pdf");
    expect(result).toEqual({
      document_number: "30123456",
      last_name: "Garcia",
      first_name: "Juan",
      source: "filename",
    });
  });

  it("parses DNI first with name", () => {
    const result = extractPatientFromFileName("30123456-Perez Maria.pdf");
    expect(result?.document_number).toBe("30123456");
    expect(result?.last_name).toBe("Perez");
    expect(result?.first_name).toBe("Maria");
  });

  it("parses DNI-only filename", () => {
    const result = extractPatientFromFileName("30123456.pdf");
    expect(result?.document_number).toBe("30123456");
    expect(result?.first_name).toBe("Importado");
  });
});

describe("extractPatientFromPdfText", () => {
  it("extracts DNI and patient name from HC text", () => {
    const text = `
      Historia Clínica
      Apellido y nombre: Pérez, María
      DNI: 30.123.456
    `;
    const result = extractPatientFromPdfText(text);
    expect(result?.document_number).toBe("30123456");
    expect(result?.last_name).toBe("Pérez");
    expect(result?.first_name).toBe("María");
  });
});

describe("mergePatientExtract", () => {
  it("prefers PDF name when filename only has DNI", () => {
    const fromFile = extractPatientFromFileName("30123456.pdf");
    const fromPdf = extractPatientFromPdfText("Paciente: Lopez Ana\nDNI 30123456");
    const merged = mergePatientExtract(fromFile, fromPdf);
    expect(merged?.last_name).toBe("Lopez");
    expect(merged?.first_name).toBe("Ana");
  });
});
