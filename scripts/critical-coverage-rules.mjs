/** Critical module coverage rules (mirrors tests/coverage-scope.ts). */
export const CRITICAL_COVERAGE = [
  {
    id: "permissions",
    label: "Authorization (permissions)",
    minLines: 94,
    minStatements: 90,
    match: (filePath) => filePath.includes("src/lib/permissions/"),
  },
  {
    id: "security",
    label: "Security utilities",
    minLines: 95,
    minStatements: 95,
    match: (filePath) =>
      filePath.includes("src/lib/security/") && !filePath.endsWith("audit-log.ts"),
  },
  {
    id: "auth-flow",
    label: "Authentication helpers",
    minLines: 95,
    minStatements: 95,
    match: (filePath) =>
      filePath.includes("src/lib/security/csrf.ts") ||
      filePath.includes("src/lib/security/tenant-scope.ts"),
  },
  {
    id: "patient-workflow",
    label: "Patient workflow utilities",
    minLines: 95,
    minStatements: 95,
    match: (filePath) =>
      filePath.includes("src/lib/utils/patient-") ||
      filePath.includes("src/lib/utils/patient-ehr") ||
      filePath.includes("src/lib/utils/clinical-navigation.ts"),
  },
  {
    id: "prescription-workflow",
    label: "Prescription / clinical workflow",
    minLines: 87,
    minStatements: 82,
    match: (filePath) =>
      filePath.includes("src/lib/utils/clinical-assistant.ts") ||
      filePath.includes("src/lib/utils/pre-visit-brief.ts") ||
      filePath.includes("src/lib/utils/consultation-documentation.ts") ||
      filePath.includes("src/lib/utils/medication-order-assist.ts") ||
      filePath.includes("src/lib/utils/lab-interpretation.ts") ||
      filePath.includes("src/lib/utils/close-encounter-assist.ts") ||
      filePath.includes("src/lib/utils/proactive-follow-up.ts") ||
      filePath.includes("src/lib/utils/clinical-copilot.ts") ||
      filePath.includes("src/lib/utils/clinical-copilot-responses.ts") ||
      filePath.includes("src/lib/utils/clinical-ai-orchestrator.ts") ||
      filePath.includes("src/lib/utils/admin-ops-types.ts") ||
      filePath.includes("src/lib/utils/admin-ops-assistant.ts") ||
      filePath.includes("src/lib/utils/admin-ops-orchestrator.ts") ||
      filePath.includes("src/lib/utils/parse-evolution-medications.ts") ||
      filePath.includes("src/lib/utils/sanitize-clinical-display.ts"),
  },
  {
    id: "medical-record",
    label: "Medical record workflow",
    minLines: 95,
    minStatements: 95,
    match: (filePath) =>
      filePath.includes("src/lib/utils/build-clinical-timeline.ts") ||
      filePath.includes("src/lib/utils/unified-clinical-evolution.ts") ||
      filePath.includes("src/lib/utils/ehr-clinical-category.ts"),
  },
];
