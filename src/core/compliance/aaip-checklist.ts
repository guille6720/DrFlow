/**
 * Phase 24 — AAIP checklist posture (Ley 25.326).
 * Technical tasks ≠ external administrative/legal tasks.
 * Database registration: GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO.
 * Do NOT claim AAIP registration has occurred.
 * Not legal advice.
 */

export const AAIP_DATABASE_REGISTRATION_FLAG =
  "GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO" as const;

export type AaipTechnicalTaskStatus =
  | "implemented"
  | "exists_needs_legal_review"
  | "draft"
  | "pending";

export type AaipTechnicalTask = {
  id: string;
  label: string;
  status: AaipTechnicalTaskStatus;
  evidence: string;
};

export type AaipExternalTask = {
  id: string;
  label: string;
  authority: string;
  flag: string;
  /** Never true in code — registration is external. */
  claimedCompletedInSoftware: false;
};

/** ### Technical tasks — implementable in software */
export const AAIP_TECHNICAL_TASKS: AaipTechnicalTask[] = [
  {
    id: "privacy_policy_published",
    label: "Política de privacidad publicada",
    status: "exists_needs_legal_review",
    evidence: "/privacidad + docs/legal/PRIVACY-POLICY-DRAFT.md",
  },
  {
    id: "terms_published",
    label: "Términos de servicio publicados",
    status: "exists_needs_legal_review",
    evidence: "/terminos + docs/legal/TERMS-OF-SERVICE-DRAFT.md",
  },
  {
    id: "patient_notice",
    label: "Aviso al paciente",
    status: "implemented",
    evidence: "/aviso-paciente",
  },
  {
    id: "booking_consent",
    label: "Consentimiento en turnos web",
    status: "implemented",
    evidence: "record_patient_data_consent",
  },
  {
    id: "clinical_informed_consent",
    label: "Consentimiento informado clínico",
    status: "implemented",
    evidence: "record_informed_consent / consent-management",
  },
  {
    id: "privacy_rights_arco",
    label: "Pedidos ARCO / habeas data",
    status: "implemented",
    evidence: "privacy-rights + habeas-data-export",
  },
  {
    id: "patient_soft_delete_retention",
    label: "Soft-delete de pacientes con retención de HC",
    status: "implemented",
    evidence: "clinical-deletion-protection",
  },
  {
    id: "immutable_audit",
    label: "Auditoría de accesos sensibles",
    status: "implemented",
    evidence: "audit_logs inmutable",
  },
  {
    id: "rls_multitenant",
    label: "RLS multi-tenant",
    status: "implemented",
    evidence: "rls-manifest + tenant isolation",
  },
  {
    id: "ai_sanitization",
    label: "Sanitización IA antes de envío externo",
    status: "implemented",
    evidence: "sanitizeClinicalAIInput()",
  },
  {
    id: "subprocessor_register",
    label: "Registro de subprocesadores",
    status: "implemented",
    evidence: "src/core/compliance/subprocessors.ts",
  },
  {
    id: "retention_policy",
    label: "Política de retención configurable",
    status: "implemented",
    evidence: "clinical_record_retention_years (default 10)",
  },
  {
    id: "dpa_draft",
    label: "DPA con clínicas (plantilla)",
    status: "draft",
    evidence: "docs/legal/DATA-PROCESSING-AGREEMENT-DRAFT.md",
  },
  {
    id: "privacy_list_subprocessors",
    label: "Enumerar subprocesadores en privacidad in-app",
    status: "pending",
    evidence: "Actualizar privacy-policy.ts tras revisión legal",
  },
];

/** ### External administrative/legal tasks — not solved by code */
export const AAIP_EXTERNAL_TASKS: AaipExternalTask[] = [
  {
    id: "database_registration",
    label: "Análisis / registro de bases de datos ante AAIP",
    authority: "AAIP",
    flag: AAIP_DATABASE_REGISTRATION_FLAG,
    claimedCompletedInSoftware: false,
  },
  {
    id: "data_protection_officer",
    label: "Designación de Responsable de Datos / contacto privacidad",
    authority: "Titular del tratamiento",
    flag: "GESTIÓN EXTERNA",
    claimedCompletedInSoftware: false,
  },
  {
    id: "security_policies_docs",
    label: "Políticas de seguridad documentadas para AAIP",
    authority: "Interno + AAIP",
    flag: "GESTIÓN EXTERNA",
    claimedCompletedInSoftware: false,
  },
  {
    id: "dpia",
    label: "Evaluación de impacto (EIPD/DPIA) para datos de salud",
    authority: "AAIP / consultor de privacidad",
    flag: "GESTIÓN EXTERNA",
    claimedCompletedInSoftware: false,
  },
  {
    id: "subprocessor_contracts",
    label: "Contratos DPA firmados con subprocesadores",
    authority: "Proveedores + abogado",
    flag: "GESTIÓN EXTERNA",
    claimedCompletedInSoftware: false,
  },
  {
    id: "international_transfers_legal_basis",
    label: "Base legal para transferencias internacionales",
    authority: "Abogado",
    flag: "GESTIÓN EXTERNA",
    claimedCompletedInSoftware: false,
  },
  {
    id: "ley_27706_update",
    label: "Actualización por Ley 27.706 (HCE)",
    authority: "Abogado especializado",
    flag: "REQUIERE VERIFICACIÓN",
    claimedCompletedInSoftware: false,
  },
];

export type AaipChecklistPosture = {
  technicalTaskCount: number;
  externalTaskCount: number;
  databaseRegistrationSolvableInCode: false;
  databaseRegistrationFlag: typeof AAIP_DATABASE_REGISTRATION_FLAG;
  /** Explicit: software must never claim AAIP DB registration is done. */
  claimsAaipRegistrationOccurred: false;
  certifiesLey25326Compliance: false;
  notes: string[];
};

export function evaluateAaipChecklistPosture(): AaipChecklistPosture {
  return {
    technicalTaskCount: AAIP_TECHNICAL_TASKS.length,
    externalTaskCount: AAIP_EXTERNAL_TASKS.length,
    databaseRegistrationSolvableInCode: false,
    databaseRegistrationFlag: AAIP_DATABASE_REGISTRATION_FLAG,
    claimsAaipRegistrationOccurred: false,
    certifiesLey25326Compliance: false,
    notes: [
      "Separar tareas técnicas de administrativas/legales externas.",
      "Registro de bases: " + AAIP_DATABASE_REGISTRATION_FLAG,
      "No afirmar que el registro AAIP haya ocurrido.",
      "Doc: docs/compliance/AAIP-CHECKLIST.md",
    ],
  };
}

export function getAaipDatabaseRegistrationTask(): AaipExternalTask {
  return AAIP_EXTERNAL_TASKS.find((t) => t.id === "database_registration")!;
}
