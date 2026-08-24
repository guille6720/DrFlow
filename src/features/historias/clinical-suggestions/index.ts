export {
  relatedActionToTreatmentEntry,
  treatmentAlreadyIncludesAction,
} from "@/features/historias/clinical-suggestions/apply-related-action";
export {
  DIAGNOSIS_ASSOCIATION_RULES,
  RELATED_ACTION_DEFINITIONS,
} from "@/features/historias/clinical-suggestions/registry";
export { resolveRelatedActionsForDiagnoses } from "@/features/historias/clinical-suggestions/resolve-related-actions";
export type {
  DiagnosisAssociationMatch,
  DiagnosisAssociationRule,
  RelatedActionApplyAs,
  RelatedActionDefinition,
  RelatedActionKind,
  ResolvedRelatedAction,
} from "@/features/historias/clinical-suggestions/types";
