import { describe, expect, it } from "vitest";

import { buildPrescriptionDocumentData } from "@/features/recetas/utils/build-prescription-document-data";
import { buildPrescriptionShareSummary } from "@/features/recetas/utils/build-prescription-share-summary";
import {
  buildPrescriptionQrImageUrl,
  buildPrescriptionQrPayload,
  shouldShowPrescriptionDocumentQr,
} from "@/features/recetas/utils/prescription-document-coverage";
import { buildPrescriptionDocumentHtml } from "@/features/recetas/utils/print-prescription-document";

const basePrescription = {
  id: "550e8400-e29b-41d4-a716-446655440099",
  created_at: "2026-08-11T12:00:00.000Z",
  issued_at: "2026-08-11T12:05:00.000Z",
  status: "issued" as const,
  prescription_number: "RX-2026-001",
  prescription_type: "ambulatoria" as const,
  validity_days: 30,
  diagnosis_cie10: "I10",
  diagnosis_text: "Hipertensión esencial",
  patient_insurance: "PAMI",
  coverage_kind: "PAMI" as const,
  insurance_number: "12345678901",
  insurance_plan: "PMO",
  medications: [{ generic_name: "Losartán", quantity: 1, posology: "1/día" }],
  notes: null,
  professional_id: "pro-1",
};

const patient = {
  first_name: "Juan",
  last_name: "Pérez",
  document_number: "30123456",
  insurance_provider: "PAMI",
  insurance_number: "12345678901",
};

const clinic = { name: "Consultorio Dr. Castro" };
const professionals = [
  {
    id: "pro-1",
    display_name: "Dr. Castro",
    license_number: "12345",
  },
];

describe("prescription document Etapa 4", () => {
  it("shows QR for PAMI coverage by default", () => {
    expect(shouldShowPrescriptionDocumentQr("PAMI")).toBe(true);
    expect(shouldShowPrescriptionDocumentQr("PARTICULAR")).toBe(false);
  });

  it("builds document data with coverage and QR payload", () => {
    const data = buildPrescriptionDocumentData(
      basePrescription,
      patient,
      clinic,
      professionals
    );

    expect(data.coverage.provider).toBe("PAMI");
    expect(data.coverage.insuranceNumber).toBe("12345678901");
    expect(data.coverage.insurancePlan).toBe("PMO");
    expect(data.showQr).toBe(true);
    expect(data.qrPayload).toContain("DRFLOW|RX|RX-2026-001");
  });

  it("builds REFEPS QR when submitted", () => {
    const data = buildPrescriptionDocumentData(
      {
        ...basePrescription,
        refeps_status: "submitted",
        refeps_id: "REFEPS-SBX-TEST123",
        digital_signature_hash: "abc",
      },
      patient,
      clinic,
      professionals
    );

    expect(data.qrTitle).toBe("Verificación REFEPS (sandbox / prueba)");
    expect(data.qrPayload).toContain("REFEPS-SBX-TEST123");
    expect(data.refepsId).toBe("REFEPS-SBX-TEST123");
    expect(data.qrHint).toMatch(/No constituye aprobación gubernamental/i);
  });

  it("renders coverage and QR in print HTML", () => {
    const data = buildPrescriptionDocumentData(
      basePrescription,
      patient,
      clinic,
      professionals
    );
    const html = buildPrescriptionDocumentHtml(data);

    expect(html).toContain("Cobertura");
    expect(html).toContain("N° beneficio");
    expect(html).toContain("Verificación local");
    expect(html).toContain("DRFLOW|RX");
  });

  it("renders PAMI vademecum code in print HTML", () => {
    const data = buildPrescriptionDocumentData(
      {
        ...basePrescription,
        medications: [
          {
            generic_name: "Rosuvastatina",
            quantity: 1,
            posology: "1/día",
            vademecum_code: "42415",
          },
        ],
      },
      patient,
      clinic,
      professionals
    );
    const html = buildPrescriptionDocumentHtml(data);
    expect(html).toContain("Cód. Alfabeta: 42415");
  });

  it("includes coverage in WhatsApp share summary", () => {
    const summary = buildPrescriptionShareSummary(basePrescription, patient);
    expect(summary).toContain("PAMI");
    expect(summary).toContain("N° beneficio");
    expect(summary).toContain("Losartán");
  });

  it("builds stable QR payload", () => {
    const payload = buildPrescriptionQrPayload({
      prescriptionNumber: "RX-1",
      prescriptionId: "abc",
      patientDocumentNumber: "30123456",
      issuedAt: "2026-08-11T12:00:00.000Z",
      coverageKind: "PAMI",
    });
    expect(payload).toBe("DRFLOW|RX|RX-1|30123456|2026-08-11|PAMI");
  });

  it("generates local QR data URL without third-party host", () => {
    const url = buildPrescriptionQrImageUrl("DRFLOW|RX|TEST");
    expect(url.startsWith("data:image/")).toBe(true);
    expect(url).not.toContain("qrserver.com");
  });
});
