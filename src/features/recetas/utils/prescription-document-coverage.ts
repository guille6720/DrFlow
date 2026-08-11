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
