import { describe, expect, it } from "vitest";

import { buildEhrPrintDocumentHtml } from "@/features/historias/utils/build-ehr-print-document-html";
import {
  dedupeTreatmentRows,
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
    expect(html).not.toContain("Firma del profesional");
    expect(html).not.toContain("drflow-ui-header");
    expect(html).not.toContain("Resumen pre-consulta");
    expect(html).toContain("@page");
    expect(html).toContain("size: A4");
  });
});

describe("ehr-print-document-helpers", () => {
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
