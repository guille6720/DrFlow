import qrcode from "qrcode-generator";

import type { CoverageRuleConfig } from "@/features/recetas/engine/types";
import {
  getEffectiveCoverageRule,
  isCoverageKind,
} from "@/features/recetas/utils/coverage-rules-admin";

import { insuranceNumberLabel } from "@/lib/constants/coverages";
import type { PrescriptionCoverageKind } from "@/types/prescription";

export type PrescriptionDocumentCoverage = {
  kind: PrescriptionCoverageKind | null;
  provider: string | null;
  insuranceNumber: string | null;
  insurancePlan: string | null;
  affiliateLabel: string;
};

export function resolvePrescriptionDocumentCoverage(input: {
  coverage_kind?: PrescriptionCoverageKind | null;
  patient_insurance?: string | null;
  insurance_number?: string | null;
  insurance_plan?: string | null;
  patientInsuranceFallback?: string | null;
  patientNumberFallback?: string | null;
}): PrescriptionDocumentCoverage {
  const provider =
    input.patient_insurance?.trim() ||
    input.patientInsuranceFallback?.trim() ||
    null;
  const insuranceNumber =
    input.insurance_number?.trim() || input.patientNumberFallback?.trim() || null;

  return {
    kind: input.coverage_kind ?? null,
    provider,
    insuranceNumber,
    insurancePlan: input.insurance_plan?.trim() || null,
    affiliateLabel: insuranceNumberLabel(provider),
  };
}

export function shouldShowPrescriptionDocumentQr(
  coverageKind: PrescriptionCoverageKind | null | undefined,
  clinicRuleOverride?: Partial<CoverageRuleConfig> | null
): boolean {
  if (!coverageKind || !isCoverageKind(coverageKind)) return false;
  return getEffectiveCoverageRule(coverageKind, clinicRuleOverride).documentQr ?? false;
}

/** Local verification payload — not REFEPS; scannable placeholder for pharmacy staff. */
export function buildPrescriptionQrPayload(input: {
  prescriptionNumber: string | null;
  prescriptionId?: string | null;
  patientDocumentNumber: string;
  issuedAt: string;
  coverageKind?: PrescriptionCoverageKind | null;
}): string {
  const parts = [
    "DRFLOW",
    "RX",
    input.prescriptionNumber?.trim() || input.prescriptionId?.slice(0, 8) || "LOCAL",
    input.patientDocumentNumber.trim(),
    input.issuedAt.slice(0, 10),
    input.coverageKind ?? "NA",
  ];
  return parts.join("|");
}

/** Sandbox CUIR QR — explicitly non-legal; never implies Ministry validation. */
export function buildSandboxCuirQrPayload(input: {
  cuirFormatted: string;
  prescriptionNumber: string | null;
}): string {
  return ["DRFLOW", "CUIR-SANDBOX", input.cuirFormatted.trim(), input.prescriptionNumber?.trim() || ""].join(
    "|"
  );
}

/** REFEPS verification payload when prescription was submitted. */
export function buildRefepsQrPayload(input: {
  refepsId: string;
  prescriptionNumber: string | null;
  digitalSignatureHash?: string | null;
}): string {
  const parts = [
    "REFEPS",
    input.refepsId.trim(),
    input.prescriptionNumber?.trim() || "",
    input.digitalSignatureHash?.slice(0, 16) ?? "",
  ];
  return parts.filter(Boolean).join("|");
}

export function resolvePrescriptionDocumentQr(input: {
  refepsStatus?: string | null;
  refepsId?: string | null;
  digitalSignatureHash?: string | null;
  prescriptionNumber: string | null;
  prescriptionId?: string | null;
  patientDocumentNumber: string;
  issuedAt: string;
  coverageKind?: PrescriptionCoverageKind | null;
  clinicRuleOverride?: Partial<CoverageRuleConfig> | null;
  nationalRxStatus?: string | null;
  cuirStatus?: string | null;
  cuirFormatted?: string | null;
}): {
  showQr: boolean;
  qrPayload: string | null;
  qrTitle: string;
  qrHint: string;
} {
  if (input.refepsStatus === "submitted" && input.refepsId?.trim()) {
    return {
      showQr: true,
      qrPayload: buildRefepsQrPayload({
        refepsId: input.refepsId,
        prescriptionNumber: input.prescriptionNumber,
        digitalSignatureHash: input.digitalSignatureHash,
      }),
      qrTitle: "Verificación REFEPS",
      qrHint:
        "Receta registrada en REFEPS/RENaPDiS. Verificá el identificador en farmacia según homologación del consultorio.",
    };
  }

  if (
    input.cuirStatus === "sandbox" &&
    input.cuirFormatted?.trim() &&
    (input.nationalRxStatus === "sandbox" || input.nationalRxStatus === "national_ready")
  ) {
    return {
      showQr: true,
      qrPayload: buildSandboxCuirQrPayload({
        cuirFormatted: input.cuirFormatted,
        prescriptionNumber: input.prescriptionNumber,
      }),
      qrTitle: "CUIR SANDBOX (sin validez legal)",
      qrHint:
        "Identificador de prueba DrFlow. No implica validación del Ministerio ni homologación ReNaPDiS.",
    };
  }

  const showLocal = shouldShowPrescriptionDocumentQr(input.coverageKind, input.clinicRuleOverride);
  if (!showLocal) {
    return { showQr: false, qrPayload: null, qrTitle: "", qrHint: "" };
  }

  return {
    showQr: true,
    qrPayload: buildPrescriptionQrPayload({
      prescriptionNumber: input.prescriptionNumber,
      prescriptionId: input.prescriptionId,
      patientDocumentNumber: input.patientDocumentNumber,
      issuedAt: input.issuedAt,
      coverageKind: input.coverageKind,
    }),
    qrTitle: "Verificación local",
    qrHint: "Placeholder DrFlow — no constituye trazabilidad REFEPS.",
  };
}

/** Local QR data URL — generated in-app; no third-party PHI exposure. */
export function buildPrescriptionQrImageUrl(payload: string, size = 120): string {
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const cellSize = Math.max(2, Math.floor(size / moduleCount));
  return qr.createDataURL(cellSize, 0);
}

export function formatPrescriptionCoverageLines(coverage: PrescriptionDocumentCoverage): string[] {
  const lines: string[] = [];
  if (coverage.provider) lines.push(`Obra social / prepaga: ${coverage.provider}`);
  if (coverage.kind) lines.push(`Tipo: ${coverage.kind}`);
  if (coverage.insuranceNumber) {
    lines.push(`${coverage.affiliateLabel}: ${coverage.insuranceNumber}`);
  }
  if (coverage.insurancePlan) lines.push(`Plan: ${coverage.insurancePlan}`);
  return lines;
}
