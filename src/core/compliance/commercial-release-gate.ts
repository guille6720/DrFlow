/**
 * Phase 25 — Commercial release gate (monetization).
 * Categories: PASS | WARNING | BLOCKER | EXTERNAL ACTION REQUIRED.
 * Technical BLOCKERs must fail automated commercialization; legal EXTERNAL stays separate.
 * Not legal advice / not AAIP certification.
 */

export type GateCategory =
  | "PASS"
  | "WARNING"
  | "BLOCKER"
  | "EXTERNAL ACTION REQUIRED";

export type CommercialGateItem = {
  id: string;
  label: string;
  category: GateCategory;
  /** If true, failing related automated checks blocks commercialization. */
  technicalBlockerIfFail: boolean;
  evidence: string;
  notes?: string;
};

/** Documented baseline status (engineering snapshot). Re-run automated gate before release. */
export const COMMERCIAL_RELEASE_GATE_ITEMS: CommercialGateItem[] = [
  // --- Technical blockers (must not fail) ---
  {
    id: "cross_tenant_isolation",
    label: "Aislamiento cross-tenant (tests estáticos)",
    category: "PASS",
    technicalBlockerIfFail: true,
    evidence: "tests/tenant-isolation-fase10.test.ts",
  },
  {
    id: "critical_rls",
    label: "Políticas RLS críticas",
    category: "PASS",
    technicalBlockerIfFail: true,
    evidence: "tests/rls-policies.test.ts + rls-manifest",
  },
  {
    id: "public_sensitive_data",
    label: "Datos sensibles no públicamente accesibles (storage privado)",
    category: "PASS",
    technicalBlockerIfFail: true,
    evidence: "storage-security + clinical-files public=false",
  },
  {
    id: "secrets_exposure",
    label: "Secretos no expuestos en repo / UI",
    category: "PASS",
    technicalBlockerIfFail: true,
    evidence: "secrets-security + security-gate.mjs",
  },
  {
    id: "ai_identifiable_phi",
    label: "IA no envía datos identificables de paciente sin sanitizar",
    category: "PASS",
    technicalBlockerIfFail: true,
    evidence: "sanitizeClinicalAIInput + clinical-ai-failsafe",
  },
  {
    id: "payment_entitlement_forge",
    label: "Entitlements / plan pago no forgeables desde cliente",
    category: "PASS",
    technicalBlockerIfFail: true,
    evidence: "monetization-security + assign_clinic_entitlement_plan",
  },
  {
    id: "audit_trail_integrity",
    label: "Integridad del audit trail",
    category: "PASS",
    technicalBlockerIfFail: true,
    evidence: "audit-log-security + prevent_audit_mutation",
  },
  // --- Warnings / external ---
  {
    id: "rls_jwt_integration",
    label: "Tests RLS con JWT real en staging",
    category: "WARNING",
    technicalBlockerIfFail: false,
    evidence: "DRFLOW_RLS_INTEGRATION=1",
  },
  {
    id: "csp_unsafe_inline",
    label: "CSP con unsafe-inline",
    category: "WARNING",
    technicalBlockerIfFail: false,
    evidence: "application-security headers",
  },
  {
    id: "legal_docs_attorney",
    label: "Documentos legales (borradores)",
    category: "EXTERNAL ACTION REQUIRED",
    technicalBlockerIfFail: false,
    evidence: "docs/legal/* — REQUIERE ABOGADO",
  },
  {
    id: "arca_invoicing",
    label: "Facturación fiscal ARCA",
    category: "EXTERNAL ACTION REQUIRED",
    technicalBlockerIfFail: false,
    evidence: "FACTURACION-ARGENTINA.md — REQUIERE CONTADOR",
  },
  {
    id: "aaip_registration",
    label: "Registro bases AAIP",
    category: "EXTERNAL ACTION REQUIRED",
    technicalBlockerIfFail: false,
    evidence: "GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO",
  },
  {
    id: "subprocessor_dpa",
    label: "DPA con subprocesadores internacionales",
    category: "EXTERNAL ACTION REQUIRED",
    technicalBlockerIfFail: false,
    evidence: "subprocessors.ts",
  },
  {
    id: "refeps_homologation",
    label: "Homologación REFEPS",
    category: "EXTERNAL ACTION REQUIRED",
    technicalBlockerIfFail: false,
    evidence: "Solo si se vende validez oficial",
  },
];

/** Vitest suites that must pass for technical commercialization gate. */
export const COMMERCIAL_GATE_REQUIRED_TEST_FILES = [
  "tests/tenant-isolation-fase10.test.ts",
  "tests/rls-policies.test.ts",
  "tests/secrets-security-fase16.test.ts",
  "tests/sanitize-clinical-ai-input.test.ts",
  "tests/clinical-ai-failsafe.test.ts",
  "tests/monetization-security-fase19.test.ts",
  "tests/audit-log-security-fase9.test.ts",
  "tests/storage-security-fase14.test.ts",
] as const;

export type CommercialReleasePosture = {
  technicalBlockerCount: number;
  externalActionCount: number;
  warningCount: number;
  passCount: number;
  automatedGateScript: string;
  documentation: string;
  notes: string[];
};

export function listTechnicalBlockerItems(): CommercialGateItem[] {
  return COMMERCIAL_RELEASE_GATE_ITEMS.filter((i) => i.technicalBlockerIfFail);
}

export function listExternalActionItems(): CommercialGateItem[] {
  return COMMERCIAL_RELEASE_GATE_ITEMS.filter(
    (i) => i.category === "EXTERNAL ACTION REQUIRED"
  );
}

export function evaluateCommercialReleasePosture(): CommercialReleasePosture {
  const items = COMMERCIAL_RELEASE_GATE_ITEMS;
  return {
    technicalBlockerCount: items.filter((i) => i.technicalBlockerIfFail).length,
    externalActionCount: items.filter((i) => i.category === "EXTERNAL ACTION REQUIRED")
      .length,
    warningCount: items.filter((i) => i.category === "WARNING").length,
    passCount: items.filter((i) => i.category === "PASS").length,
    automatedGateScript: "scripts/commercial-release-gate.mjs",
    documentation: "docs/compliance/MONETIZATION-GATE.md",
    notes: [
      "Fallos en tests de aislamiento/RLS/secretos/IA/pagos/audit/storage = BLOCKER técnico.",
      "Procedimientos legales/contables = EXTERNAL ACTION REQUIRED (separados).",
      "npm run commercial:gate",
    ],
  };
}

/** Hard-fail conditions for commercialization (engineering). */
export const COMMERCIAL_TECHNICAL_BLOCKER_CONDITIONS = [
  "cross-tenant isolation tests fail",
  "critical RLS policies fail",
  "sensitive data can be publicly accessed",
  "secrets are exposed",
  "AI sends identifiable patient data unexpectedly",
  "payment entitlement can be forged",
  "audit trail integrity is broken",
] as const;
