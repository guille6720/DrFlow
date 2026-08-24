/**
 * Phase 22 — Legal document draft catalog (templates for Argentine attorney review).
 * These are NOT final legal advice. In-app published pages may differ until counsel approves.
 */

export const LEGAL_DRAFT_ATTORNEY_BANNER =
  "BORRADOR — REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA ANTES DE SU USO COMERCIAL" as const;

export type LegalDraftDocumentId =
  | "terms_of_service"
  | "privacy_policy"
  | "data_processing_agreement"
  | "subprocessors"
  | "security_annex"
  | "ai_processing_notice";

export type LegalDraftDocument = {
  id: LegalDraftDocumentId;
  file: string;
  title: string;
  purpose: string;
  /** Always true for Phase 22 templates. */
  isDraftRequiringAttorney: true;
};

/** Required templates under docs/legal/ */
export const LEGAL_DRAFT_DOCUMENTS: LegalDraftDocument[] = [
  {
    id: "terms_of_service",
    file: "docs/legal/TERMS-OF-SERVICE-DRAFT.md",
    title: "Términos de Servicio",
    purpose: "Condiciones de uso del SaaS DrFlow entre operador y Cliente (consultorio).",
    isDraftRequiringAttorney: true,
  },
  {
    id: "privacy_policy",
    file: "docs/legal/PRIVACY-POLICY-DRAFT.md",
    title: "Política de Privacidad",
    purpose: "Información sobre tratamiento de datos personales y de salud.",
    isDraftRequiringAttorney: true,
  },
  {
    id: "data_processing_agreement",
    file: "docs/legal/DATA-PROCESSING-AGREEMENT-DRAFT.md",
    title: "Acuerdo de Tratamiento de Datos (DPA)",
    purpose: "Encargo de tratamiento Cliente (responsable) ↔ DrFlow (encargado).",
    isDraftRequiringAttorney: true,
  },
  {
    id: "subprocessors",
    file: "docs/legal/SUBPROCESSORS-DRAFT.md",
    title: "Registro de Subprocesadores",
    purpose: "Lista de proveedores; alineada con subprocessors.ts.",
    isDraftRequiringAttorney: true,
  },
  {
    id: "security_annex",
    file: "docs/legal/SECURITY-ANNEX-DRAFT.md",
    title: "Anexo de Seguridad",
    purpose: "Medidas técnicas y organizativas referidas en el DPA.",
    isDraftRequiringAttorney: true,
  },
  {
    id: "ai_processing_notice",
    file: "docs/legal/AI-PROCESSING-NOTICE-DRAFT.md",
    title: "Aviso de Procesamiento con IA",
    purpose: "Transparencia sobre asistentes clínicos, sanitización y límites.",
    isDraftRequiringAttorney: true,
  },
];

export type LegalDocumentsPosture = {
  templateCount: number;
  allRequireAttorneyReview: true;
  representedAsFinalLegalAdvice: false;
  banner: typeof LEGAL_DRAFT_ATTORNEY_BANNER;
  notes: string[];
};

export function evaluateLegalDocumentsPosture(): LegalDocumentsPosture {
  return {
    templateCount: LEGAL_DRAFT_DOCUMENTS.length,
    allRequireAttorneyReview: true,
    representedAsFinalLegalAdvice: false,
    banner: LEGAL_DRAFT_ATTORNEY_BANNER,
    notes: [
      "Plantillas en docs/legal/ para revisión profesional — no son textos finales.",
      "No sustituyen asesoramiento legal ni certificación AAIP/Ley 25.326.",
      "Textos in-app (/terminos, /privacidad) pueden diferir hasta aprobación de abogado.",
    ],
  };
}

export function assertLegalDraftBannerPresent(markdown: string): boolean {
  return markdown.includes(LEGAL_DRAFT_ATTORNEY_BANNER);
}
