import { describe, expect, it } from "vitest";

import { buildEhrPrintDocumentHtml } from "@/features/historias/utils/build-ehr-print-document-html";

describe("buildEhrPrintDocumentHtml", () => {
  it("builds an isolated Equipos-style document without app chrome", () => {
    const html = buildEhrPrintDocumentHtml({
      scope: "all",
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
      },
      consultations: [
        {
          id: "c1",
          created_at: "2022-11-10T12:04:12.000Z",
          professional_name: "Leonardi, Oscar Angel",
          professional_license_national: "455344",
          professional_license_provincial: "160261",
          professional_email: "osleonardi@gmail.com",
          chief_complaint: "",
          diagnosis: "Infarto transmural agudo del miocardio de la pared anterior",
          evolution: "me comunico via telefonica",
          indications: "GASTEC Laboratorios Be\n20 mg caps.x 70",
          category: "evolution",
        },
      ],
      dayConsultations: [],
      diagnosisRows: [
        {
          id: "d1",
          dateLabel: "10-NOV-22",
          name: "Infarto transmural agudo del miocardio de la pared anterior",
          chronic: true,
          recordId: "c1",
        },
      ],
      treatmentRows: [
        {
          id: "t1",
          dateLabel: "10-NOV-22",
          product: "GASTEC Laboratorios Be",
          dose: "20 mg caps.x 70",
          frequency: "—",
          notes: "GASTEC Laboratorios Be",
          status: "Actual",
          recordId: "c1",
        },
      ],
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("abalo, jorge guillermo");
    expect(html).toContain("Evoluciones");
    expect(html).toContain("Diagnósticos");
    expect(html).toContain("Tratamientos");
    expect(html).not.toContain("drflow-ui-header");
    expect(html).not.toContain("Resumen pre-consulta");
  });
});
