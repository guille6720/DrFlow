/**
 * Capa de asociaciones diagnóstico → acciones relacionadas.
 * Fuera del núcleo de persistencia de Historia Clínica: solo UX de accesos rápidos.
 * Ampliar asociaciones editando el registry; no requiere cambios en el save de HC.
 */

export type RelatedActionKind =
  | "control"
  | "lab"
  | "study"
  | "interconsult"
  | "conduct"
  | "pharmacologic"
  | "non_pharmacologic";

/** Qué ocurre SOLO tras confirmación explícita del profesional. */
export type RelatedActionApplyAs = {
  type: "clinical_treatment";
  product: string;
  treatmentKind: "conduct" | "non_pharmacologic" | "pharmacologic";
  category: string;
};

export type RelatedActionDefinition = {
  id: string;
  label: string;
  kind: RelatedActionKind;
  /** Texto corto de ayuda (no es indicación clínica automática). */
  hint?: string;
  applyAs: RelatedActionApplyAs;
};

export type DiagnosisAssociationMatch = {
  /** Prefijos CIE-10 (ej. "I10" matchea I10, I10.0…). */
  cie10Prefixes?: string[];
  /** Subcadenas normalizadas del nombre del diagnóstico. */
  nameIncludes?: string[];
  clinicalDiagnosisIds?: string[];
};

export type DiagnosisAssociationRule = {
  id: string;
  label: string;
  match: DiagnosisAssociationMatch;
  actionIds: string[];
};

export type ResolvedRelatedAction = RelatedActionDefinition & {
  /** Regla(s) que aportaron esta acción (trazabilidad UX). */
  fromRuleIds: string[];
  fromDiagnosisNames: string[];
};
