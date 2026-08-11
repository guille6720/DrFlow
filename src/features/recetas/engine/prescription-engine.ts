import { mergeCoverageRules } from "@/features/recetas/engine/default-coverage-rules";
import { findDuplicateMedications } from "@/features/recetas/engine/medication-duplicates";
import { resolveCoverageKind } from "@/features/recetas/engine/resolve-coverage-kind";
import {
  getCoverageStrategy,
  getCoverageStrategyForInsurance,
} from "@/features/recetas/engine/strategies/coverage-strategies";
import type {
  CoverageKind,
  CoverageRuleConfig,
  PrescriptionContext,
  PrescriptionDraftInput,
  PrescriptionEngineRow,
  PrescriptionPatientContext,
  PrescriptionProfessionalContext,
  ValidationIssue,
  ValidationResult,
} from "@/features/recetas/engine/types";

export type BuildPrescriptionContextInput = {
  clinicId: string;
  patient: PrescriptionPatientContext;
  professional: PrescriptionProfessionalContext;
  patientInsurance?: string | null;
  coverageKind?: CoverageKind | null;
  clinicRuleOverrides?: Partial<CoverageRuleConfig> | null;
};

export function buildPrescriptionContext(input: BuildPrescriptionContextInput): PrescriptionContext {
  const patientInsurance =
    input.patientInsurance?.trim() ||
    input.patient.insurance_provider?.trim() ||
    null;
  const coverageKind =
    input.coverageKind ?? resolveCoverageKind(patientInsurance);
  const rules = mergeCoverageRules(coverageKind, input.clinicRuleOverrides);

  return {
    clinicId: input.clinicId,
    patient: input.patient,
    professional: input.professional,
    coverageKind,
    patientInsurance,
    rules,
  };
}

function baseValidation(draft: PrescriptionEngineRow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!draft.patient_id) {
    issues.push({
      severity: "error",
      code: "patient_required",
      field: "patient_id",
      message: "Seleccioná un paciente.",
    });
  }

  if (!draft.professional_id) {
    issues.push({
      severity: "error",
      code: "professional_required",
      field: "professional_id",
      message: "Seleccioná el profesional prescriptor.",
    });
  }

  if (!draft.medications?.length) {
    issues.push({
      severity: "error",
      code: "medications_required",
      field: "medications",
      message: "Agregá al menos un medicamento.",
    });
  }

  for (const [index, med] of (draft.medications ?? []).entries()) {
    if (!med.generic_name?.trim()) {
      issues.push({
        severity: "error",
        code: "medication_generic_required",
        field: `medications.${index}.generic_name`,
        message: `Línea ${index + 1}: el principio activo / genérico es obligatorio.`,
      });
    }
    if (!med.posology?.trim()) {
      issues.push({
        severity: "error",
        code: "medication_posology_required",
        field: `medications.${index}.posology`,
        message: `Línea ${index + 1}: las indicaciones / posología son obligatorias.`,
      });
    }
    if (med.quantity <= 0) {
      issues.push({
        severity: "error",
        code: "medication_quantity_invalid",
        field: `medications.${index}.quantity`,
        message: `Línea ${index + 1}: la cantidad debe ser mayor a 0.`,
      });
    }
  }

  issues.push(...findDuplicateMedications(draft.medications ?? []));

  if (draft.validity_days < 1 || draft.validity_days > 365) {
    issues.push({
      severity: "error",
      code: "validity_invalid",
      field: "validity_days",
      message: "La validez debe estar entre 1 y 365 días.",
    });
  }

  return issues;
}

function hasLicense(professional: PrescriptionProfessionalContext): boolean {
  return Boolean(
    professional.license_national?.trim() || professional.license_provincial?.trim()
  );
}

export function validatePrescriptionDraft(
  ctx: PrescriptionContext,
  draft: PrescriptionEngineRow,
  mode: "draft" | "issue"
): ValidationResult {
  const strategy = getCoverageStrategy(ctx.coverageKind);
  const issues: ValidationIssue[] = [...baseValidation(draft)];

  if (mode === "issue") {
    if (!draft.disclaimer_accepted) {
      issues.push({
        severity: "error",
        code: "disclaimer_required",
        field: "disclaimer_accepted",
        message: "Debés aceptar el aviso legal antes de emitir.",
      });
    }

    if (!hasLicense(ctx.professional)) {
      issues.push({
        severity: "error",
        code: "license_required",
        field: "professional_id",
        message: "El profesional debe tener matrícula cargada para emitir.",
      });
    }

    issues.push(...strategy.validate(ctx, draft));

    const maxValidity = ctx.rules.maxValidityDays;
    if (maxValidity != null && draft.validity_days > maxValidity) {
      issues.push({
        severity: "error",
        code: "validity_exceeds_coverage",
        field: "validity_days",
        message: `La validez máxima para ${ctx.coverageKind} es ${maxValidity} días.`,
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  return { valid: errors.length === 0, issues };
}

export function getPrescriptionWarnings(
  ctx: PrescriptionContext,
  draft: PrescriptionEngineRow
): ValidationIssue[] {
  const strategy = getCoverageStrategy(ctx.coverageKind);
  return strategy.getWarnings(ctx, draft);
}

export function resolveAuthoritativeCoverageForIssue(
  patient: PrescriptionPatientContext,
  draft: Pick<
    PrescriptionDraftInput,
    "insurance_number" | "insurance_plan"
  >
): {
  patientInsurance: string | null;
  coverageKind: CoverageKind;
  insuranceNumber: string | null;
  insurancePlan: string | null;
} {
  const patientInsurance = patient.insurance_provider?.trim() || null;
  const coverageKind = resolveCoverageKind(patientInsurance);

  return {
    patientInsurance,
    coverageKind,
    insuranceNumber:
      draft.insurance_number?.trim() || patient.insurance_number?.trim() || null,
    insurancePlan: draft.insurance_plan?.trim() || patient.insurance_plan?.trim() || null,
  };
}

export function enrichDraftFromPatient(
  draft: PrescriptionDraftInput,
  patient: PrescriptionPatientContext
): PrescriptionDraftInput {
  const insurance = draft.patient_insurance?.trim() || patient.insurance_provider?.trim() || null;
  const coverageKind = draft.coverage_kind ?? resolveCoverageKind(insurance);

  return {
    ...draft,
    patient_insurance: insurance,
    coverage_kind: coverageKind,
    insurance_number:
      draft.insurance_number?.trim() || patient.insurance_number?.trim() || null,
    insurance_plan: draft.insurance_plan?.trim() || patient.insurance_plan?.trim() || null,
  };
}

export function resolveStrategyForDraft(draft: PrescriptionDraftInput) {
  const insurance = draft.patient_insurance ?? null;
  if (draft.coverage_kind) return getCoverageStrategy(draft.coverage_kind);
  return getCoverageStrategyForInsurance(insurance);
}

/** @deprecated Use named exports — kept as namespace for tests/documentation */
export const PrescriptionEngine = {
  buildPrescriptionContext,
  validatePrescriptionDraft,
  getPrescriptionWarnings,
  enrichDraftFromPatient,
  resolveCoverageKind,
};

export { resolveCoverageKind };
