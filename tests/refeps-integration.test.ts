import { describe, expect, it } from "vitest";

import {
  buildUnsignedRefepsPayload,
  validateRefepsSubmissionPrerequisites,
} from "@/core/refeps/payload";
import {
  getRefepsConfigurationHint,
  isRefepsApiConfigured,
  resolveRefepsSubmissionMode,
} from "@/core/refeps/provider";

import {
  buildPrescriptionQrPayload,
  buildRefepsQrPayload,
  resolvePrescriptionDocumentQr,
} from "@/features/recetas/utils/prescription-document-coverage";

import type { ElectronicPrescription } from "@/types/prescription";

const basePrescription = {
  id: "550e8400-e29b-41d4-a716-446655440099",
  clinic_id: "clinic-1",
  patient_id: "patient-1",
  clinical_record_id: null,
  professional_id: "pro-1",
  prescription_type: "ambulatoria" as const,
  diagnosis_cie10: "I10",
  diagnosis_text: "Hipertensión",
  patient_insurance: "PAMI",
  coverage_kind: "PAMI" as const,
  insurance_number: "12345678901",
  insurance_plan: null,
  medications: [{ generic_name: "Losartán", quantity: 1, posology: "1/día" }],
  notes: null,
  validity_days: 30,
  disclaimer_accepted: true,
  status: "issued" as const,
  prescription_number: "RX-2026-001",
  issued_at: "2026-08-11T12:05:00.000Z",
  refeps_status: "pending_refeps" as const,
  refeps_id: null,
  created_at: "2026-08-11T12:00:00.000Z",
  updated_at: "2026-08-11T12:05:00.000Z",
  version: 1,
  idempotency_key: null,
};

describe("refeps integration phase 2E", () => {
  it("resolves sandbox mode without API env", () => {
    expect(isRefepsApiConfigured()).toBe(false);
    expect(resolveRefepsSubmissionMode()).toBe("sandbox");
    expect(getRefepsConfigurationHint()).toContain("REFEPS_API_URL");
  });

  it("builds stable payload hash", () => {
    const { payload, signatureHash } = buildUnsignedRefepsPayload({
      mode: "sandbox",
      clinic: { id: "c1", name: "Consultorio", establishmentCode: "EST-1" },
      professional: {
        id: "p1",
        fullName: "Dr. Test",
        licenseNational: "12345",
        licenseProvincial: null,
        licenseNumber: null,
        specialtyName: "Clínica",
        signatureText: "Dr. Test MN 12345",
      },
      patient: {
        id: "pat1",
        documentNumber: "30123456",
        firstName: "Juan",
        lastName: "Pérez",
        insuranceProvider: "PAMI",
        insuranceNumber: "123",
      },
      prescription: basePrescription as ElectronicPrescription,
    });

    expect(signatureHash).toHaveLength(64);
    expect(payload.digital_signature_hash).toBe(signatureHash);
    expect(payload.mode).toBe("sandbox");
    expect(payload.source).toBe("drflow");
  });

  it("validates submission prerequisites", () => {
    expect(
      validateRefepsSubmissionPrerequisites({
        prescription: { ...basePrescription, status: "draft" } as ElectronicPrescription,
        professional: {
          id: "p1",
          fullName: "Dr.",
          licenseNational: "1",
          licenseProvincial: null,
          licenseNumber: null,
          specialtyName: null,
          signatureText: null,
        },
        patient: {
          id: "pat1",
          documentNumber: "30123456",
          firstName: "Juan",
          lastName: "Pérez",
          insuranceProvider: null,
          insuranceNumber: null,
        },
        clinicSettings: { enabled: true, establishmentCode: "EST-1" },
      })
    ).toContain("emitidas");

    expect(
      validateRefepsSubmissionPrerequisites({
        prescription: basePrescription as ElectronicPrescription,
        professional: {
          id: "p1",
          fullName: "Dr.",
          licenseNational: "12345",
          licenseProvincial: null,
          licenseNumber: null,
          specialtyName: null,
          signatureText: null,
        },
        patient: {
          id: "pat1",
          documentNumber: "",
          firstName: "Juan",
          lastName: "Pérez",
          insuranceProvider: null,
          insuranceNumber: null,
        },
        clinicSettings: { enabled: true, establishmentCode: "EST-1" },
      })
    ).toContain("documento");
  });

  it("prefers REFEPS QR when submitted", () => {
    const qr = resolvePrescriptionDocumentQr({
      refepsStatus: "submitted",
      refepsId: "REFEPS-SBX-ABC123",
      digitalSignatureHash: "a".repeat(64),
      prescriptionNumber: "RX-1",
      prescriptionId: "rx-id",
      patientDocumentNumber: "30123456",
      issuedAt: "2026-08-11T12:00:00.000Z",
      coverageKind: "PAMI",
    });

    expect(qr.showQr).toBe(true);
    expect(qr.qrTitle).toBe("Verificación REFEPS");
    expect(qr.qrPayload).toContain("REFEPS-SBX-ABC123");
  });

  it("builds local QR when not submitted", () => {
    const local = buildPrescriptionQrPayload({
      prescriptionNumber: "RX-1",
      prescriptionId: "rx-id",
      patientDocumentNumber: "30123456",
      issuedAt: "2026-08-11T12:00:00.000Z",
      coverageKind: "PAMI",
    });
    expect(local).toContain("DRFLOW|RX");

    const refeps = buildRefepsQrPayload({
      refepsId: "REFEPS-SBX-TEST",
      prescriptionNumber: "RX-1",
      digitalSignatureHash: "abc123",
    });
    expect(refeps).toContain("REFEPS|REFEPS-SBX-TEST");
  });
});
