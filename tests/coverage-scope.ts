/** Core business logic — target 90% (Phase 19). Módulos críticos con suite activa. */
export const COVERAGE_INCLUDE = [
  "src/lib/app-release.ts",
  "src/lib/booking/**",
  "src/lib/permissions/**",
  "src/lib/security/csrf.ts",
  "src/lib/security/tenant-scope.ts",
  "src/lib/security/audit-types.ts",
  "src/lib/security/rls-manifest.ts",
  "src/lib/validations/form-errors.ts",
  "src/lib/jobs/registry.ts",
  "src/lib/jobs/enqueue.ts",
  "src/lib/jobs/types.ts",
  "src/lib/features/flags/**",
  "src/lib/observability/types.ts",
  "src/lib/observability/trace-id.ts",
  "src/lib/accessibility/**",
  "src/plugins/**",
  "src/lib/qa/**",
  "src/lib/constants/pami-planillas.ts",
  "src/lib/constants/cash-register.ts",
  "src/lib/constants/command-palette-items.ts",
  "src/lib/utils/cn.ts",
  "src/lib/utils/clinical-navigation.ts",
  "src/lib/utils/normalize-dni.ts",
  "src/lib/utils/whatsapp.ts",
  "src/lib/utils/patient-search.ts",
  "src/lib/utils/clinical-indicators.ts",
  "src/lib/utils/clinic-timezone.ts",
  "src/lib/utils/clinical-assistant.ts",
  "src/lib/utils/pre-visit-brief.ts",
  "src/lib/utils/consultation-documentation.ts",
  "src/lib/utils/medication-order-assist.ts",
  "src/lib/utils/clinical-csv-parse.ts",
  "src/lib/utils/build-clinical-timeline.ts",
  "src/lib/utils/command-palette-search.ts",
  "src/lib/utils/ehr-clinical-category.ts",
  "src/lib/utils/unified-clinical-evolution.ts",
  "src/lib/utils/parse-evolution-medications.ts",
  "src/lib/utils/patient-age.ts",
  "src/lib/utils/patient-ehr-model.ts",
  "src/lib/utils/sanitize-clinical-display.ts",
  "src/lib/utils/yearly-attended-patients.ts",
];

export const COVERAGE_EXCLUDE = ["**/*.server.ts", "node_modules/**"];

/** Critical modules — higher thresholds enforced by check-critical-coverage.mjs */
export const CRITICAL_COVERAGE = [
  {
    id: "permissions",
    label: "Authorization (permissions)",
    minLines: 94,
    minStatements: 90,
    match: (filePath: string) => filePath.includes("src/lib/permissions/"),
  },
  {
    id: "security",
    label: "Security utilities",
    minLines: 95,
    minStatements: 95,
    match: (filePath: string) =>
      filePath.includes("src/lib/security/") && !filePath.endsWith("audit-log.ts"),
  },
  {
    id: "auth-flow",
    label: "Authentication helpers",
    minLines: 95,
    minStatements: 95,
    match: (filePath: string) =>
      filePath.includes("src/lib/security/csrf.ts") ||
      filePath.includes("src/lib/security/tenant-scope.ts"),
  },
  {
    id: "patient-workflow",
    label: "Patient workflow utilities",
    minLines: 95,
    minStatements: 95,
    match: (filePath: string) =>
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
