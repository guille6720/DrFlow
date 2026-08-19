import { describe, expect, it } from "vitest";

import { buildEhrPrintDocumentHtml } from "@/features/historias/utils/build-ehr-print-document-html";
import {
  dedupeTreatmentRows,
  evolutionBodyWithoutExtractedBlocks,
  parseVitalsFromText,
} from "@/features/historias/utils/ehr-print-document-helpers";

describe("buildEhrPrintDocumentHtml", () => {
  it("builds a professional clinical history document without app chrome", () => {
    const html = buildEhrPrintDocumentHtml({
      scope: "all",
      generatedAt: new Date("2026-08-15T17:00:00.000Z"),
      patient: {
        id: "p1",
        first_name: "jorge guillermo",
        last_name: "abalo",
        document_number: "12459480",
        birth_date: "1936-05-21",
        age_label: "90 años",
        insurance_provider: "PAMI",
        insurance_number: "5156156165",
        phone: "+54 11 6155 9512",
        email: "paciente@example.com",
      },
      clinicalContext: {
        allergies: "Penicilina",
        medicalHistory: "HTA",
        regularMedication: null,
        problemList: [
          {
            id: "pl1",
            name: "Hipertensión esencial",
            cie10_code: "I10",
            status: "Crónico",
            noted_at: "2022-01-01T00:00:00.000Z",
            source_clinical_record_id: "c1",
          },
        ],
      },
      consultations: [
        {
          id: "c1",
          created_at: "2022-11-10T12:04:12.000Z",
          professional_id: "pro1",
          professional_name: "Leonardi, Oscar Angel",
          professional_license_national: "455344",
          professional_license_provincial: "160261",
          professional_email: "osleonardi@gmail.com",
          chief_complaint: "",
          diagnosis: "Infarto transmural agudo del miocardio de la pared anterior",
          evolution:
            "me comunico via telefonica\n\nSignos vitales: TA 170/70 FC 67 Peso 60 kg SatO2 97%",
          indications: "GASTEC Laboratorios Be\n20 mg caps.x 70",
          category: "evolution",
        },
      ],
      dayConsultations: [],
      diagnosisRows: [
        {
          id: "d1",
          dateLabel: "10-NOV-22",
          recordCreatedAt: "2022-11-10T12:00:00.000Z",
          name: "Infarto transmural agudo del miocardio de la pared anterior",
          chronic: true,
          recordId: "c1",
        },
        {
          id: "d2",
          dateLabel: "10-NOV-22",
          recordCreatedAt: "2022-11-10T12:00:00.000Z",
          name: "Infarto transmural agudo del miocardio de la pared anterior",
          chronic: true,
          recordId: "c1",
        },
      ],
      treatmentRows: [
        {
          id: "t1",
          dateLabel: "10-NOV-22",
          recordCreatedAt: "2022-11-10T12:00:00.000Z",
          product: "GASTEC Laboratorios Be",
          dose: "20 mg caps.x 70",
          frequency: "—",
          notes: "GASTEC Laboratorios Be",
          status: "Actual",
          recordId: "c1",
        },
        {
          id: "t2",
          dateLabel: "10-NOV-22",
          recordCreatedAt: "2022-11-10T12:00:00.000Z",
          product: "GASTEC",
          dose: "20 mg caps.x 70",
          frequency: "—",
          notes: "—",
          status: "Actual",
          recordId: "c1",
        },
      ],
      professionals: [
        {
          id: "pro1",
          display_name: "Leonardi, Oscar Angel",
          license_national: "455344",
          signature_text: "Dr. Leonardi",
          signature_image_url: "https://example.com/firma.png",
        },
      ],
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("DRFLOW");
    expect(html).toContain("Historia Clínica Completa");
    expect(html).toContain("abalo, jorge guillermo");
    expect(html).toContain("Resumen clínico");
    expect(html).toContain("Penicilina");
    expect(html).toContain("Evoluciones");
    expect(html).toContain("Diagnósticos");
    expect(html).toContain("Tratamiento / conducta");
    expect(html).toContain("Signos vitales");
    expect(html).toContain("Tratamientos y medicación");
    expect(html).toContain("Matrícula:");
    expect(html).toContain('class="sig-img"');
    expect(html).toContain('class="doc-sign"');
    expect(html).not.toContain('class="evo-sign"');
    expect(html).not.toContain("Firma del profesional");
    expect(html).not.toContain("drflow-ui-header");
    expect(html).not.toContain("Resumen pre-consulta");
    expect(html).toContain("@page");
    expect(html).toContain("size: A4");
  });

  it("places a single signature at the end of multi-evolution histories", () => {
    const html = buildEhrPrintDocumentHtml({
      scope: "all",
      generatedAt: new Date("2026-08-15T17:00:00.000Z"),
      patient: {
        id: "p1",
        first_name: "Ana",
        last_name: "García",
        document_number: "12345678",
        birth_date: "1980-01-01",
        age_label: "46 años",
        insurance_provider: null,
        insurance_number: null,
        phone: null,
        email: null,
      },
      consultations: [
        {
          id: "c2",
          created_at: "2024-02-01T12:00:00.000Z",
          professional_id: "pro1",
          professional_name: "Leonardi, Oscar Angel",
          professional_license_national: "455344",
          chief_complaint: "Control",
          diagnosis: "HTA",
          evolution: "Estable en segundo control.",
          indications: "",
          category: "evolution",
        },
        {
          id: "c1",
          created_at: "2023-01-01T12:00:00.000Z",
          professional_id: "pro1",
          professional_name: "Leonardi, Oscar Angel",
          professional_license_national: "455344",
          chief_complaint: "Consulta",
          diagnosis: "HTA",
          evolution: "Primera evolución clínica.",
          indications: "",
          category: "evolution",
        },
      ],
      dayConsultations: [],
      diagnosisRows: [],
      treatmentRows: [],
      professionals: [
        {
          id: "pro1",
          display_name: "Leonardi, Oscar Angel",
          license_national: "455344",
          signature_image_url: "https://example.com/firma.png",
        },
      ],
    });

    expect(html.match(/class="doc-sign"/g)).toHaveLength(1);
    expect(html.indexOf("Estable en segundo control.")).toBeLessThan(html.indexOf('class="doc-sign"'));
    expect(html.indexOf("Primera evolución clínica.")).toBeLessThan(html.indexOf('class="doc-sign"'));
  });

  it("prints the full daily evolution when the note is a titled medical report", () => {
    const report = [
      "## INFORME MÉDICO EXTENSO DE SEGUIMIENTO Y EVOLUCIÓN",
      "**Paciente:** López Vida, Maria del Carmen",
      "### 1. Antecedentes Clínicos",
      "HTA y DBT tipo 2.",
      "### 2. Resumen Cronológico",
      "Control ambulatorio estable.",
    ].join("\n");

    const html = buildEhrPrintDocumentHtml({
      scope: "day",
      generatedAt: new Date("2026-08-19T15:33:00.000Z"),
      patient: {
        id: "p1",
        first_name: "Csv",
        last_name: "Importado",
        document_number: "93361885",
        birth_date: null,
        age_label: null,
        insurance_provider: null,
        insurance_number: null,
        phone: null,
        email: null,
      },
      consultations: [],
      dayConsultations: [
        {
          id: "c-day",
          created_at: "2026-08-19T15:33:00.000Z",
          professional_name: "angel castro",
          professional_license_national: "12569",
          chief_complaint: "",
          diagnosis: "",
          evolution: report,
          indications: "",
          category: "evolution",
        },
      ],
      diagnosisRows: [],
      treatmentRows: [],
    });

    expect(html).toContain("INFORME MÉDICO EXTENSO DE SEGUIMIENTO Y EVOLUCIÓN");
    expect(html).toContain("López Vida, Maria del Carmen");
    expect(html).toContain("Antecedentes Clínicos");
    expect(html).toContain("Control ambulatorio estable.");
    expect(html).toContain('class="block evo-body"');
    expect(html).not.toMatch(/<h3 class="block-title">Evolución<\/h3><div class="prose">##<\/div>/);
  });
});

describe("ehr-print-document-helpers", () => {
  it("keeps titled medical reports when stripping print side-blocks", () => {
    const report = [
      "## INFORME MÉDICO EXTENSO DE SEGUIMIENTO Y EVOLUCIÓN",
      "**Paciente:** López Vida, Maria del Carmen",
      "### 2. Resumen Cronológico",
      "Control ambulatorio estable.",
    ].join("\n");

    expect(evolutionBodyWithoutExtractedBlocks(report)).toContain("INFORME MÉDICO EXTENSO");
    expect(evolutionBodyWithoutExtractedBlocks(report)).toContain("Control ambulatorio estable.");
  });

  it("parses vitals without inventing values", () => {
    expect(parseVitalsFromText("Signos vitales: TA 170/70 FC 67 Peso 60 kg")).toMatchObject({
      TA: "170/70",
      FC: "67",
      Peso: "60 kg",
    });
  });

  it("dedupes treatments that share brand and dose", () => {
    const rows = dedupeTreatmentRows([
      {
        id: "t1",
        dateLabel: "10-NOV-22",
        recordCreatedAt: "2022-11-10T12:00:00.000Z",
        product: "GASTEC Laboratorios Be",
        dose: "20 mg",
        frequency: "1/día",
        notes: "—",
        status: "Actual",
        recordId: "c1",
      },
      {
        id: "t2",
        dateLabel: "10-NOV-22",
        recordCreatedAt: "2022-11-10T12:00:00.000Z",
        product: "GASTEC",
        dose: "20 mg",
        frequency: "1/día",
        notes: "—",
        status: "Actual",
        recordId: "c1",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.product).toContain("GASTEC");
  });
});
