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

  it("extracts DrApp multiline DNI block", () => {
    const text = "Nombre\nGarcía, Ana\nDNI\n12.345.678\n";
    const result = extractPatientFromPdfText(text);
    expect(result?.document_number).toBe("12345678");
    expect(result?.last_name).toBe("García");
  });

  it("extracts 7-digit DNI formatted as 3.736.532 (DrApp)", () => {
    const text = "Nombre\nLudeña, Delicia\nDNI\n3.736.532\n";
    const result = extractPatientFromPdfText(text);
    expect(result?.document_number).toBe("3736532");
    expect(result?.last_name).toBe("Ludeña");
    expect(result?.first_name).toBe("Delicia");
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
