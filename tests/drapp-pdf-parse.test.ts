import { describe, it, expect } from "vitest";
import {
  isDrAppClinicalExport,
  parseDrAppDemographics,
  parseDrAppEvolutions,
  parseDrAppChronicDiagnoses,
} from "@/lib/utils/drapp-pdf-parse";
import { extractPatientFromPdfText } from "@/lib/utils/pdf-patient-extract";

const SAMPLE_HEADER = `
Nombre
Ludeña, Delicia
DNI
3.736.532
Edad 28 DIC 1938
PAMI
# 15591915210100
Teléfono
+54 11 6369 8434
02-JUL-26 Leonardi, Oscar Angel
Evoluciones
20:06:57 	Leonardi, Oscar Angel osleonardi@gmail.com
CIERRE DE HISTORIA CLÍNICA INSTITUCIONAL Y REPORTE DE ÓBITO
Datos del Paciente
Paciente: LUDUEÑA, Delicia
3. Reporte de Óbito
Con posterioridad a su derivación de urgencia, se notifica el fallecimiento.
4. Medidas y Acciones Administrativas Institucionales
Se procede a la clausura formal de la Historia Clínica activa.
30-JUN-26 Leonardi, Oscar Angel
Evoluciones
21:07:47 	Leonardi, Oscar Angel osleonardi@gmail.com
LUDUEÑA, Delicia
Signos Vitales: TA 114/75 mmHg | FC 64 lpm
Contexto Previo: Paciente de alta fragilidad.
Evolución Actual: Se evidencia febrícula (37.4 °C).
Conducta: Antitérmicos según necesidad (Paracetamol). Curva térmica estricta cada 6 horas.
`;

describe("isDrAppClinicalExport", () => {
  it("detects DrApp export layout", () => {
    expect(isDrAppClinicalExport(SAMPLE_HEADER)).toBe(true);
  });

  it("rejects generic PDF text", () => {
    expect(isDrAppClinicalExport("Informe médico simple\nPaciente: Juan")).toBe(false);
  });
});

describe("extractPatientFromPdfText DrApp", () => {
  it("reads name and DNI from DrApp header", () => {
    const result = extractPatientFromPdfText(SAMPLE_HEADER);
    expect(result?.document_number).toBe("3736532");
    expect(result?.last_name).toBe("Ludeña");
    expect(result?.first_name).toBe("Delicia");
  });
});

describe("parseDrAppDemographics", () => {
  it("extracts PAMI, phone and birth date", () => {
    const demo = parseDrAppDemographics(SAMPLE_HEADER);
    expect(demo.insurance_provider).toBe("PAMI");
    expect(demo.insurance_number).toBe("15591915210100");
    expect(demo.phone).toContain("6369");
    expect(demo.birth_date).toBe("1938-12-28");
  });
});

describe("parseDrAppEvolutions", () => {
  it("splits evolution blocks with conducta mapping", () => {
    const entries = parseDrAppEvolutions(SAMPLE_HEADER);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const jun30 = entries.find((e) => e.consultationDate === "2026-06-30");
    expect(jun30?.indications).toMatch(/Paracetamol/i);
    expect(jun30?.chief_complaint).toContain("[DrApp:");
  });
});

describe("parseDrAppChronicDiagnoses", () => {
  it("parses chronic diagnosis names", () => {
    const text = `
Diagnósticos
Fecha 	Nombre
07-JUL
Crónico
Otros hipotiroidismos
osleonardi@gmail.com
Diabetes mellitus no insulinodependiente
Tratamientos
`;
    expect(parseDrAppChronicDiagnoses(text)).toEqual([
      "Otros hipotiroidismos",
      "Diabetes mellitus no insulinodependiente",
    ]);
  });
});
