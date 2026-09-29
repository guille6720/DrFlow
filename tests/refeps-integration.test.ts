import { afterEach, describe, expect, it } from "vitest";

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

const REFEPS_ENV_KEYS = [
  "REFEPS_API_URL",
  "REFEPS_API_KEY",
  "REFEPS_VALIDATION_API_URL",
  "REFEPS_VALIDATION_API_KEY",
  "REFEPS_VALIDATION_MODE",
] as const;

describe("refeps integration (validation-only after 0.2.19)", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("is unavailable (not silently sandbox) without env", () => {
    for (const key of REFEPS_ENV_KEYS) delete process.env[key];
    expect(isRefepsApiConfigured()).toBe(false);
    expect(resolveRefepsSubmissionMode()).toBe("unavailable");
    expect(getRefepsConfigurationHint()).toContain("REFEPS_API_URL");
  });

  it("reports explicit sandbox only when REFEPS_VALIDATION_MODE=sandbox", () => {
    for (const key of REFEPS_ENV_KEYS) delete process.env[key];
    process.env.REFEPS_VALIDATION_MODE = "sandbox";
    expect(resolveRefepsSubmissionMode()).toBe("sandbox");
  });

  it("legacy REFEPS-SBX ids keep sandbox disclaimer language", () => {
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
    expect(qr.qrTitle).toBe("Verificación REFEPS (sandbox / prueba)");
    expect(qr.qrPayload).toContain("REFEPS-SBX-ABC123");
    expect(qr.qrHint).toMatch(/No constituye aprobación gubernamental/i);
  });

  it("legacy non-sandbox ids are labeled without official validity", () => {
    const qr = resolvePrescriptionDocumentQr({
      refepsStatus: "submitted",
      refepsId: "LEGACY-123",
      prescriptionNumber: "RX-1",
      patientDocumentNumber: "30123456",
      issuedAt: "2026-08-11T12:00:00.000Z",
      coverageKind: "PAMI",
    });
    expect(qr.qrTitle).toMatch(/sin validez oficial/i);
    expect(qr.qrHint).toMatch(/No es un CUIR/);
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
