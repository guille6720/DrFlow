/**
 * Phase 18 — Clinical research / protocol AI gate.
 * Recruitment and trial-matching features stay OFF for production until privacy/legal review.
 * Not legal advice.
 */

import type { FeatureFlagId } from "@/features/flags/lib/registry";
import { getFeatureFlagDefinition } from "@/features/flags/lib/registry";

import { findProtocolByMessage, foldMedicalText } from "@/lib/ai/gemini-medical-lexicon";

/** Feature flag that must stay default OFF until review is complete. */
export const CLINICAL_RESEARCH_PROTOCOLS_FLAG: FeatureFlagId = "clinical_research_protocols";

export const CLINICAL_RESEARCH_DISABLED_USER_MESSAGE =
  "Los protocolos de investigación clínica y la búsqueda de candidatos están desactivados para este consultorio. " +
  "Un administrador puede habilitar el flag «Protocolos de investigación clínica» en Configuración solo después de completar la revisión legal y de privacidad documentada.";

export type ClinicalResearchSurface = {
  id: string;
  label: string;
  gatedByFlag: true;
  defaultEnabled: false;
  notes: string;
};

export const CLINICAL_RESEARCH_SURFACES: ClinicalResearchSurface[] = [
  {
    id: "consulta_protocols_panel",
    label: "Panel Protocolos en consulta (inclusión/exclusión)",
    gatedByFlag: true,
    defaultEnabled: false,
    notes: "UI DrappProtocolsQuickPanel — inserta nota de screening en evolución.",
  },
  {
    id: "gemini_protocol_matching",
    label: "Matching de candidatos a protocolos vía Gemini / stats IA",
    gatedByFlag: true,
    defaultEnabled: false,
    notes: "parseGeminiClinicStatsQuery + loadGeminiClinicStats con protocol/candidateNeedles.",
  },
  {
    id: "gemini_protocol_catalog",
    label: "Catálogo GEMINI_CLINICAL_PROTOCOLS (lexicón)",
    gatedByFlag: true,
    defaultEnabled: false,
    notes: "Datos de referencia; no se usan para reclutamiento si el flag está OFF.",
  },
];

export type ClinicalResearchReviewItem = {
  id: string;
  label: string;
  status: "required_before_activation" | "recommended";
};

/** Privacy / legal checklist before enabling the flag in production. */
export const CLINICAL_RESEARCH_PRIVACY_LEGAL_REVIEW: ClinicalResearchReviewItem[] = [
  {
    id: "patient_notice",
    label: "Aviso / consentimiento informado sobre uso de HC para screening de ensayos (si aplica)",
    status: "required_before_activation",
  },
  {
    id: "purpose_limitation",
    label: "Limitación de finalidad: screening interno vs cesión a sponsor / CRO",
    status: "required_before_activation",
  },
  {
    id: "ai_subprocessor",
    label: "Revisión de subprocesador IA (Vertex/Gemini) y transferencias internacionales",
    status: "required_before_activation",
  },
  {
    id: "minimization",
    label: "Minimización: tokens anonimizados, sin export masivo de filas PHI al sponsor",
    status: "required_before_activation",
  },
  {
    id: "access_control",
    label: "Quién del consultorio puede activar el flag y ver listados de candidatos",
    status: "required_before_activation",
  },
  {
    id: "ethics_committee",
    label: "Coordinación con comité de ética / investigador principal del estudio (si aplica)",
    status: "recommended",
  },
  {
    id: "aaip_record",
    label: "Actualización de registro / política de privacidad ante AAIP si el tratamiento es nuevo",
    status: "recommended",
  },
];

const RECRUITMENT_INTENT =
  /candidat|reclut|pacientes?\s+para\s+(el\s+)?(estudio|protocolo)|deriv(ar|aci[oó]n)\s+a\s+(estudio|protocolo)|elegib|inclusi[oó]n|exclusi[oó]n|screening|ensayo\s+cl[ií]n/;

/** True when the user message targets protocol criteria or candidate recruitment. */
export function detectsClinicalResearchIntent(message: string): boolean {
  const folded = foldMedicalText(message.trim());
  if (!folded) return false;
  if (findProtocolByMessage(folded)) return true;
  return RECRUITMENT_INTENT.test(folded);
}

export function assertClinicalResearchFlagDefaultsOff(): boolean {
  return getFeatureFlagDefinition(CLINICAL_RESEARCH_PROTOCOLS_FLAG).defaultEnabled === false;
}

export type ClinicalResearchAiPosture = {
  featureFlag: FeatureFlagId;
  defaultEnabled: false;
  productionAutoEnable: false;
  surfaceCount: number;
  reviewItemCount: number;
  notes: string[];
};

export function evaluateClinicalResearchAiPosture(): ClinicalResearchAiPosture {
  return {
    featureFlag: CLINICAL_RESEARCH_PROTOCOLS_FLAG,
    defaultEnabled: false,
    productionAutoEnable: false,
    surfaceCount: CLINICAL_RESEARCH_SURFACES.length,
    reviewItemCount: CLINICAL_RESEARCH_PRIVACY_LEGAL_REVIEW.length,
    notes: [
      "No habilitar automáticamente en producción.",
      "UI de protocolos y matching IA de candidatos respetan el mismo flag.",
      "Activación requiere checklist de revisión legal/privacidad documentada.",
      "El matching por texto de HC no es elegibilidad final del sponsor.",
    ],
  };
}
