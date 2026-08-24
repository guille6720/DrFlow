/**
 * Phase 26 — Testing campaign posture for Argentina compliance / monetization branch.
 * Documents required suites; does not hide failures.
 * Classify: pre-existing vs introduced by compliance work.
 */

export type TestingSuiteId =
  | "lint"
  | "typecheck"
  | "unit"
  | "integration_rls"
  | "build"
  | "rls_static"
  | "tenant_isolation"
  | "ai_sanitization"
  | "authorization"
  | "payment_webhook"
  | "commercial_gate";

export type TestingSuiteDefinition = {
  id: TestingSuiteId;
  label: string;
  command: string;
};

export const PHASE26_REQUIRED_SUITES: TestingSuiteDefinition[] = [
  { id: "lint", label: "Lint", command: "npm run lint" },
  { id: "typecheck", label: "Typecheck", command: "npx tsc --noEmit" },
  { id: "unit", label: "Unit tests", command: "npx vitest run" },
  {
    id: "integration_rls",
    label: "RLS integration (JWT)",
    command: "npm run test:rls",
  },
  { id: "build", label: "Production build", command: "npm run build" },
  {
    id: "rls_static",
    label: "RLS static policies",
    command: "npx vitest run tests/rls-policies.test.ts",
  },
  {
    id: "tenant_isolation",
    label: "Tenant isolation",
    command: "npx vitest run tests/tenant-isolation-fase10.test.ts",
  },
  {
    id: "ai_sanitization",
    label: "AI sanitization + failsafe",
    command:
      "npx vitest run tests/sanitize-clinical-ai-input.test.ts tests/clinical-ai-failsafe.test.ts",
  },
  {
    id: "authorization",
    label: "Authorization / permissions",
    command: "npx vitest run tests/permissions.test.ts tests/member-permissions.test.ts",
  },
  {
    id: "payment_webhook",
    label: "Payment / webhook monetization",
    command:
      "npx vitest run tests/mercadopago-billing.test.ts tests/monetization-security-fase19.test.ts",
  },
  {
    id: "commercial_gate",
    label: "Commercial release gate",
    command: "npm run commercial:gate",
  },
];

export type FailureClassification = "pre_existing" | "introduced_by_compliance_work" | "fixed_in_phase_26";

export type DocumentedFailure = {
  suite: string;
  summary: string;
  classification: FailureClassification;
  notes: string;
};

/**
 * Snapshot of known failures observed during Phase 26 run (2026-08-24).
 * Update when re-running the campaign.
 */
export const PHASE26_FAILURE_LEDGER: DocumentedFailure[] = [
  {
    suite: "migrations-consistency",
    summary: "Expected latest migration 128; branch added through 138",
    classification: "fixed_in_phase_26",
    notes: "Updated expectations to 138_commercial_essential_pro.sql",
  },
  {
    suite: "csrf-audit",
    summary: "MP webhook POST without CSRF helper",
    classification: "fixed_in_phase_26",
    notes: "Allowlisted verifyMercadoPagoWebhookSignature (HMAC, not browser CSRF)",
  },
  {
    suite: "clinical-workflow-context / lib-core / patient-workspace-tabs",
    summary: "patientWorkflowHref / patientClinicalHistoryPath URL expectations outdated",
    classification: "pre_existing",
    notes: "Navigation product changes unrelated to compliance monetization phases",
  },
  {
    suite: "xss-audit",
    summary: "dangerouslySetInnerHTML outside theme bootstrap allowlist",
    classification: "pre_existing",
    notes: "Previously noted (e.g. superadmin manual); not introduced by fases 13–25",
  },
  {
    suite: "performance/dashboard-first-paint",
    summary: "Dashboard quick actions assertion mismatch",
    classification: "pre_existing",
    notes: "UI/copy drift; not from compliance modules",
  },
];

export type TestingCampaignPosture = {
  requiredSuiteCount: number;
  hideFailuresForbidden: true;
  separatesPreExistingFromIntroduced: true;
  documentation: string;
  notes: string[];
};

export function evaluateTestingCampaignPosture(): TestingCampaignPosture {
  return {
    requiredSuiteCount: PHASE26_REQUIRED_SUITES.length,
    hideFailuresForbidden: true,
    separatesPreExistingFromIntroduced: true,
    documentation: "docs/compliance/TESTING-FASE-26.md",
    notes: [
      "No ocultar fallos: ledger en PHASE26_FAILURE_LEDGER.",
      "Fallos introducidos por compliance se corrigen o se listan explícitamente.",
      "RLS JWT integration puede quedar skipped sin DRFLOW_RLS_INTEGRATION=1.",
    ],
  };
}
