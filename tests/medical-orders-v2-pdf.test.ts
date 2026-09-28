import { describe, expect, it } from "vitest";

import type { MedicalOrderDetail } from "@/features/ordenes-medicas/types";
import { buildMedicalOrderPdf, medicalOrderPdfFileName } from "@/features/ordenes-medicas/utils/export-medical-order-pdf";

function order(overrides: Partial<MedicalOrderDetail> = {}): MedicalOrderDetail {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    patient_id: "p",
    professional_id: "pr",
    clinical_record_id: null,
    status: "issued",
    order_text: "Laboratorio\n- Hemograma completo",
    order_type: "study",
    order_category: "laboratorio",
    order_number: "OM-2026-00000042",
    priority: "urgente",
    valid_until: "2026-12-31",
    issued_at: "2026-09-28T15:00:00Z",
    created_at: "2026-09-28T15:00:00Z",
    voided_at: null,
    void_reason: null,
    diagnosis_text: "Anemia",
    patient_name: "Pérez, Ana",
    patient_document: "30111222",
    professional_name: "Dr. Gómez",
    isV2: true,
    notes: null,
    diagnosis_code: "D64.9",
    clinical_indication: null,
    preparation_instructions: "Ayuno de 8 horas",
    public_verification_token: "b".repeat(64),
    document_hash: "c".repeat(64),
    patient_snapshot: { first_name: "Ana", last_name: "Pérez", document_number: "30111222", birth_date: "1990-01-01" },
    issuer_snapshot: { full_name: "Dr. Gómez", license_national: "12345", clinic_name: "Clínica Test" },
    voided_by: null,
    items: [{ id: "i1", category: "laboratorio", code: null, name: "Hemograma completo", description: null, metadata: {}, sort_order: 0 }],
    ...overrides,
  };
}

function pdfText(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("latin1");
}

describe("medical order A4 PDF", () => {
  it("renders an A4 document with the order number and study", async () => {
    const doc = await buildMedicalOrderPdf(order(), `https://x.test/verify/medical-order/${"b".repeat(64)}`);
    const text = pdfText(doc.output("arraybuffer"));
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).toContain("OM-2026-00000042");
    expect(text).toContain("Hemograma completo");
    expect(text).toContain("MN 12345");
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(210);
  });

  it("marks annulled orders", async () => {
    const doc = await buildMedicalOrderPdf(order({ status: "void", voided_at: "2026-09-29T10:00:00Z" }), null);
    expect(pdfText(doc.output("arraybuffer"))).toContain("ANULADA");
  });

  it("uses the order number in the file name", () => {
    expect(medicalOrderPdfFileName(order())).toBe("orden-medica-OM-2026-00000042.pdf");
  });
});
