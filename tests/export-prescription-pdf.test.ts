import { describe, expect, it, vi } from "vitest";

import { buildPrescriptionDocumentData } from "@/features/recetas/utils/build-prescription-document-data";
import { formatPrescriptionCoverageLines } from "@/features/recetas/utils/prescription-document-coverage";

const saveMock = vi.fn();

vi.mock("@/lib/utils/jspdf-loader", () => ({
  loadJsPdf: async () =>
    class {
      setFontSize() {}
      setFont() {}
      text() {}
      splitTextToSize(value: string) {
        return [value];
      }
      addImage() {}
      addPage() {}
      save = saveMock;
    },
}));

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

describe("exportPrescriptionPdf", () => {
  it("downloads PDF from unified document data with coverage and QR", async () => {
    saveMock.mockClear();
    const { downloadPrescriptionPdf } = await import(
      "@/features/recetas/utils/export-prescription-pdf"
    );
    const data = buildPrescriptionDocumentData(
      basePrescription,
      patient,
      clinic,
      professionals
    );

    await downloadPrescriptionPdf(data);

    expect(data.showQr).toBe(true);
    expect(formatPrescriptionCoverageLines(data.coverage).length).toBeGreaterThan(0);
    expect(saveMock).toHaveBeenCalledWith("receta-RX-2026-001.pdf");
  });
});
