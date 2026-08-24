/** Core business logic — target 90% (Phase 19). Módulos críticos con suite activa. */
export const COVERAGE_INCLUDE = [
  "src/core/app-release.ts",
  "src/core/booking/**",
  "src/core/permissions/roles.ts",
  "src/core/security/csrf.ts",
  "src/core/security/tenant-scope.ts",
  "src/core/security/audit-types.ts",
  "src/core/security/rls-manifest.ts",
  "src/core/validations/form-errors.ts",
  "src/core/jobs/registry.ts",
  "src/core/jobs/enqueue.ts",
  "src/core/jobs/types.ts",
  "src/features/flags/lib/**",
  "src/core/observability/types.ts",
  "src/core/observability/trace-id.ts",
  "src/core/accessibility/**",
  "src/plugins/**",
  "src/lib/constants/pami-planillas.ts",
  "src/lib/constants/cash-register.ts",
  "src/lib/constants/command-palette-items.ts",
  "src/shared/utils/cn.ts",
  "src/shared/utils/clinical-navigation.ts",
  "src/lib/utils/normalize-dni.ts",
  "src/shared/utils/whatsapp.ts",
  "src/features/pacientes/utils/patient-search.ts",
  "src/features/pacientes/utils/patient-age.ts",
  "src/features/pacientes/utils/patient-ehr-model.ts",
  "src/lib/utils/clinical-indicators.ts",
  "src/shared/utils/clinic-timezone.ts",
  "src/lib/utils/clinical-assistant.ts",
  "src/lib/utils/pre-visit-brief.ts",
  "src/lib/utils/consultation-documentation.ts",
  "src/lib/utils/medication-order-assist.ts",
  "src/lib/utils/lab-interpretation.ts",
  "src/lib/utils/close-encounter-assist.ts",
  "src/lib/utils/proactive-follow-up.ts",
  "src/lib/utils/clinical-copilot.ts",
  "src/lib/utils/clinical-copilot-responses.ts",
  "src/lib/utils/clinical-ai-orchestrator.ts",
  "src/lib/utils/admin-ops-types.ts",
  "src/lib/utils/admin-ops-assistant.ts",
  "src/lib/utils/admin-ops-orchestrator.ts",
  "src/lib/utils/admin-analytics-types.ts",
  "src/lib/utils/clinical-csv-parse.ts",
  "src/lib/utils/build-clinical-timeline.ts",
  "src/lib/utils/command-palette-search.ts",
  "src/lib/utils/ehr-clinical-category.ts",
  "src/lib/utils/unified-clinical-evolution.ts",
  "src/lib/utils/parse-evolution-medications.ts",
  "src/lib/utils/sanitize-clinical-display.ts",
  "src/features/pacientes/utils/clinical-workspace-alerts.ts",
  "src/shared/utils/stabilization-limits.ts",
  "src/features/dashboard/utils/clinical-ops-metrics.ts",
  "src/lib/utils/yearly-attended-patients.ts",
  "src/core/entitlements/**",
];

export const COVERAGE_EXCLUDE = ["**/*.server.ts", "node_modules/**"];

/** Critical modules — higher thresholds enforced by check-critical-coverage.mjs */
export const CRITICAL_COVERAGE = [
  {
    id: "permissions",
    label: "Authorization (permissions)",
    minLines: 94,
    minStatements: 90,
    match: (filePath: string) =>
      filePath.includes("src/core/permissions/roles.ts") ||
      filePath.includes("src/lib/permissions/roles.ts"),
  },
  {
    id: "security",
    label: "Security utilities",
    minLines: 95,
    minStatements: 95,
    match: (filePath: string) =>
      (filePath.includes("src/core/security/") || filePath.includes("src/lib/security/")) &&
      !filePath.endsWith("audit-log.ts"),
  },
  {
    id: "auth-flow",
    label: "Authentication helpers",
    minLines: 95,
    minStatements: 95,
    match: (filePath: string) =>
      filePath.includes("src/core/security/csrf.ts") ||
      filePath.includes("src/lib/security/csrf.ts") ||
      filePath.includes("src/core/security/tenant-scope.ts") ||
      filePath.includes("src/lib/security/tenant-scope.ts"),
  },
  {
    id: "patient-workflow",
    label: "Patient workflow utilities",
    minLines: 95,
    minStatements: 95,
    match: (filePath: string) =>
      filePath.includes("src/features/pacientes/utils/patient-age.ts") ||
      filePath.includes("src/features/pacientes/utils/patient-search.ts") ||
      filePath.includes("src/features/pacientes/utils/patient-ehr-model.ts") ||
      filePath.includes("src/shared/utils/clinical-navigation.ts") ||
      filePath.includes("src/lib/utils/patient-") ||
      filePath.includes("src/lib/utils/patient-ehr") ||
      filePath.includes("src/lib/utils/clinical-navigation.ts"),
  },
  {
    id: "prescription-workflow",
    label: "Prescription / clinical workflow",
    minLines: 87,
    minStatements: 82,
    match: (filePath: string) =>
      filePath.includes("src/lib/utils/clinical-assistant.ts") ||
      filePath.includes("src/lib/utils/parse-evolution-medications.ts") ||
      filePath.includes("src/lib/utils/sanitize-clinical-display.ts"),
  },
  {
    id: "medical-record",
    label: "Medical record workflow",
    minLines: 95,
    minStatements: 95,
    match: (filePath: string) =>
      filePath.includes("src/lib/utils/build-clinical-timeline.ts") ||
      filePath.includes("src/lib/utils/unified-clinical-evolution.ts") ||
      filePath.includes("src/lib/utils/ehr-clinical-category.ts"),
  },
] as const;
