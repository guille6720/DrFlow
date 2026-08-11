import type {
  CoverageKind,
  CoverageRuleConfig,
  PrescriptionContext,
  PrescriptionEngineRow,
  ValidationIssue,
} from "@/features/recetas/engine/types";

export interface CoverageStrategy {
  readonly kind: CoverageKind;
  matches(insurance: string | null | undefined): boolean;
  getDefaultRules(): CoverageRuleConfig;
  validate(ctx: PrescriptionContext, draft: PrescriptionEngineRow): ValidationIssue[];
  getWarnings(ctx: PrescriptionContext, draft: PrescriptionEngineRow): ValidationIssue[];
}

function readField(draft: PrescriptionEngineRow, field: string): string | null {
  switch (field) {
    case "insurance_number":
      return draft.insurance_number?.trim() || null;
    case "insurance_plan":
      return draft.insurance_plan?.trim() || null;
    case "diagnosis_cie10":
      return draft.diagnosis_cie10?.trim() || null;
    case "diagnosis_text":
      return draft.diagnosis_text?.trim() || null;
    case "patient_insurance":
      return draft.patient_insurance?.trim() || null;
    case "professional_id":
      return draft.professional_id?.trim() || null;
    default:
      return null;
  }
}

const FIELD_LABELS: Record<string, string> = {
  insurance_number: "N° de afiliado / beneficio",
  insurance_plan: "Plan de cobertura",
  diagnosis_cie10: "Diagnóstico CIE-10",
  diagnosis_text: "Diagnóstico",
  patient_insurance: "Cobertura",
  professional_id: "Profesional prescriptor",
};

export function validateRequiredFields(
  ctx: PrescriptionContext,
  draft: PrescriptionEngineRow
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of ctx.rules.requiredFields) {
    if (!readField(draft, field)) {
      issues.push({
        severity: "error",
        code: "required_field",
        field,
        message: `${FIELD_LABELS[field] ?? field} es obligatorio para ${ctx.coverageKind}.`,
      });
    }
  }
  return issues;
}

export abstract class BaseCoverageStrategy implements CoverageStrategy {
  abstract readonly kind: CoverageKind;

  abstract matches(insurance: string | null | undefined): boolean;

  abstract getDefaultRules(): CoverageRuleConfig;

  validate(ctx: PrescriptionContext, draft: PrescriptionEngineRow): ValidationIssue[] {
    return validateRequiredFields(ctx, draft);
  }

  getWarnings(_ctx: PrescriptionContext, _draft: PrescriptionEngineRow): ValidationIssue[] {
    return [];
  }
}
