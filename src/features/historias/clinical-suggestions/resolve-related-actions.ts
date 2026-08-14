import {
  DIAGNOSIS_ASSOCIATION_RULES,
  RELATED_ACTION_DEFINITIONS,
} from "@/features/historias/clinical-suggestions/registry";
import type {
  DiagnosisAssociationRule,
  ResolvedRelatedAction,
} from "@/features/historias/clinical-suggestions/types";
import type { ClinicalDiagnosisEntry } from "@/features/historias/utils/clinical-structured-entries";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesRule(diagnosis: ClinicalDiagnosisEntry, rule: DiagnosisAssociationRule): boolean {
  const cie = diagnosis.cie10_code?.trim().toUpperCase() ?? "";
  if (cie && rule.match.cie10Prefixes?.some((prefix) => cie.startsWith(prefix.toUpperCase()))) {
    return true;
  }

  const id = diagnosis.clinical_diagnosis_id?.trim();
  if (id && rule.match.clinicalDiagnosisIds?.includes(id)) {
    return true;
  }

  const name = normalizeText(diagnosis.name ?? "");
  if (!name) return false;
  return (rule.match.nameIncludes ?? []).some((needle) => name.includes(normalizeText(needle)));
}

/**
 * Resuelve sugerencias a partir de diagnósticos ya seleccionados.
 * Puro: no persiste, no selecciona, no inventa dosis.
 */
export function resolveRelatedActionsForDiagnoses(
  diagnoses: ClinicalDiagnosisEntry[],
  options?: {
    rules?: DiagnosisAssociationRule[];
    definitions?: typeof RELATED_ACTION_DEFINITIONS;
  }
): ResolvedRelatedAction[] {
  if (!diagnoses.length) return [];

  const rules = options?.rules ?? DIAGNOSIS_ASSOCIATION_RULES;
  const definitions = options?.definitions ?? RELATED_ACTION_DEFINITIONS;
  const byActionId = new Map<string, ResolvedRelatedAction>();

  for (const diagnosis of diagnoses) {
    for (const rule of rules) {
      if (!matchesRule(diagnosis, rule)) continue;
      for (const actionId of rule.actionIds) {
        const def = definitions[actionId];
        if (!def) continue;
        const existing = byActionId.get(actionId);
        if (existing) {
          if (!existing.fromRuleIds.includes(rule.id)) {
            existing.fromRuleIds.push(rule.id);
          }
          if (!existing.fromDiagnosisNames.includes(diagnosis.name)) {
            existing.fromDiagnosisNames.push(diagnosis.name);
          }
          continue;
        }
        byActionId.set(actionId, {
          ...def,
          fromRuleIds: [rule.id],
          fromDiagnosisNames: [diagnosis.name],
        });
      }
    }
  }

  return [...byActionId.values()];
}
