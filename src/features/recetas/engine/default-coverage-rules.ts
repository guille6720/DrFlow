import type { CoverageKind, CoverageRuleConfig } from "@/features/recetas/engine/types";

/**
 * Default coverage rules — configurable per clinic via `coverage_rules` table.
 * PAMI-specific normative requirements are NOT invented here; extend via DB config.
 */
export const DEFAULT_COVERAGE_RULES: Record<CoverageKind, CoverageRuleConfig> = {
  PAMI: {
    requiredFields: ["insurance_number", "diagnosis_cie10", "diagnosis_text"],
    maxValidityDays: 30,
    medicationSearch: "medication_catalog",
    documentQr: true,
    infoMessages: [
      "Paciente PAMI: verificá beneficio y cobertura antes de emitir.",
      "Normativa PAMI adicional puede configurarse en reglas de cobertura de la clínica.",
    ],
  },
  OBRAS_SOCIALES: {
    requiredFields: ["insurance_number"],
    maxValidityDays: 30,
    medicationSearch: "medication_catalog",
  },
  PREPAGAS: {
    requiredFields: ["insurance_number", "insurance_plan"],
    maxValidityDays: 30,
    medicationSearch: "medication_catalog",
  },
  PARTICULAR: {
    requiredFields: [],
    maxValidityDays: 30,
    medicationSearch: "medication_catalog",
  },
};

export function mergeCoverageRules(
  kind: CoverageKind,
  clinicOverrides?: Partial<CoverageRuleConfig> | null
): CoverageRuleConfig {
  const base = DEFAULT_COVERAGE_RULES[kind];
  if (!clinicOverrides) return base;
  return {
    ...base,
    ...clinicOverrides,
    requiredFields: clinicOverrides.requiredFields ?? base.requiredFields,
    infoMessages: clinicOverrides.infoMessages ?? base.infoMessages,
  };
}
