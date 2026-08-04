export type EnterprisePhaseStatus = "completed" | "audit" | "planned";

export type EnterprisePhase = {
  id: number;
  slug: string;
  title: string;
  goal: string;
  status: EnterprisePhaseStatus;
  commits?: string[];
  migrations?: string[];
  docs?: string[];
  keyPaths?: string[];
};

/**
 * Registro oficial del plan Enterprise Transformation (20 fases).
 * Fuente de verdad para tests y documentación — Fase 20.
 */
export const ENTERPRISE_PHASES: EnterprisePhase[] = [
  {
    id: 1,
    slug: "auditoria",
    title: "Auditoría automática",
    goal: "Inventario de deuda técnica, god components y riesgos OWASP sin modificar código.",
    status: "audit",
    docs: ["AUDITORIA.md"],
  },
  {
    id: 2,
    slug: "refactor",
    title: "Refactorización arquitectónica",
    goal: "Dividir componentes >200 líneas en módulos enfocados.",
    status: "completed",
    commits: ["922d7de", "b8a9da1", "6a705e7", "63f9c28", "a0d0350"],
    keyPaths: [
      "src/components/pacientes/patient-chart-view.tsx",
      "src/components/historias/patient-ehr-view.tsx",
      "src/components/profesionales/professional-intake-view.tsx",
      "src/components/recetas/prescriptions-orders-hub.tsx",
    ],
  },
  {
    id: 3,
    slug: "modularizacion",
    title: "Modularización",
    goal: "Feature modules con barrels públicos y registry compartido.",
    status: "completed",
    commits: ["1909d14"],
    keyPaths: ["src/features/", "src/features/_shared/registry.ts"],
  },
  {
    id: 4,
    slug: "historia-clinica",
    title: "Historia clínica centrada en el paciente",
    goal: "Workspace con pestañas como hub de HC en /pacientes/[id].",
    status: "completed",
    commits: ["ac34ea1"],
    keyPaths: [
      "src/lib/constants/patient-workspace-tabs.ts",
      "src/components/pacientes/patient-workspace/",
    ],
  },
  {
    id: 5,
    slug: "dashboard",
    title: "Centro de operaciones clínicas",
    goal: "Dashboard operativo: espera, turnos próximos, flujo clínico.",
    status: "completed",
    commits: ["2f06295"],
    keyPaths: [
      "src/components/dashboard/clinical-operations-dashboard.tsx",
      "src/lib/server/load-clinical-operations-dashboard.ts",
    ],
  },
  {
    id: 6,
    slug: "ux",
    title: "UX — menos clics",
    goal: "Paleta de comandos global, atajos Ctrl+K / Ctrl+Shift+N.",
    status: "completed",
    commits: ["560156a"],
    keyPaths: [
      "src/components/command-palette/",
      "src/components/clinical-workflow/",
      "src/lib/constants/command-palette-items.ts",
      "src/lib/utils/clinical-workflow-context.ts",
      "docs/WORKFLOW_OPTIMIZATION.md",
    ],
  },
  {
    id: 7,
    slug: "ia",
    title: "Asistente clínico integrado",
    goal: "IA embebida: resumen, SOAP, alertas de seguridad (no módulo aislado).",
    status: "completed",
    commits: ["ab67040"],
    keyPaths: ["src/lib/utils/clinical-assistant.ts", "src/components/clinical-assistant/"],
  },
  {
    id: 8,
    slug: "timeline",
    title: "Timeline clínica unificada",
    goal: "Línea de tiempo filtrable con links entre eventos clínicos.",
    status: "completed",
    commits: ["d5d093b"],
    keyPaths: ["src/lib/utils/build-clinical-timeline.ts"],
  },
  {
    id: 9,
    slug: "performance",
    title: "Performance",
    goal: "React Compiler, loaders unificados, Suspense, índices SQL.",
    status: "completed",
    commits: ["2e1e002"],
    migrations: ["046_performance_indexes.sql"],
  },
  {
    id: 10,
    slug: "seguridad",
    title: "Seguridad",
    goal: "RLS, CSRF auth, aislamiento PHI, trial enforcement.",
    status: "completed",
    commits: ["008da77"],
    migrations: ["047_security_phase10.sql"],
    docs: ["docs/RLS_AUDIT.md"],
  },
  {
    id: 11,
    slug: "multi-tenant",
    title: "Multi-tenant",
    goal: "clinic_id en toda query sensible; helpers tenant-scope.",
    status: "completed",
    commits: ["dbb3d9d"],
    keyPaths: ["src/lib/security/tenant-scope.ts"],
  },
  {
    id: 12,
    slug: "auditoria-clinica",
    title: "Auditoría clínica inmutable",
    goal: "Trail de cambios: quién, qué, cuándo, valores previos.",
    status: "completed",
    commits: ["23be50f"],
    migrations: ["048_audit_phase12.sql"],
    keyPaths: ["src/lib/security/audit.ts", "src/lib/server/load-patient-audit-trail.ts"],
  },
  {
    id: 13,
    slug: "plugins",
    title: "Plataforma de plugins",
    goal: "Módulos activables por clínica sin recompilar.",
    status: "completed",
    commits: ["49d2790"],
    migrations: ["049_plugins_phase13.sql"],
    keyPaths: ["src/plugins/", "src/components/configuracion/clinic-plugins-panel.tsx"],
  },
  {
    id: 14,
    slug: "feature-flags",
    title: "Feature flags",
    goal: "Flags granulares por clínica dentro de plugins activos.",
    status: "completed",
    commits: ["10d18db"],
    migrations: ["050_feature_flags_phase14.sql"],
    keyPaths: ["src/lib/features/flags/", "src/components/configuracion/clinic-feature-flags-panel.tsx"],
  },
  {
    id: 15,
    slug: "job-queue",
    title: "Cola de trabajos",
    goal: "Emails, PDF, importaciones e IA async — UI nunca bloqueada.",
    status: "completed",
    commits: ["20b8dfc", "ed92c79"],
    migrations: ["051_clinic_jobs_phase15.sql"],
    keyPaths: ["src/lib/jobs/", "src/app/api/jobs/process/route.ts"],
  },
  {
    id: 16,
    slug: "observabilidad",
    title: "Observabilidad",
    goal: "Telemetría, health checks, trace IDs, purge 30 días.",
    status: "completed",
    commits: ["9b252e9"],
    migrations: ["052_observability_phase16.sql"],
    keyPaths: ["src/lib/observability/", "src/app/api/health/route.ts"],
  },
  {
    id: 17,
    slug: "accesibilidad",
    title: "Accesibilidad WCAG AA",
    goal: "Skip link, focus visible, landmarks, reduced motion.",
    status: "completed",
    commits: ["63cfc6b"],
    keyPaths: ["src/lib/accessibility/", "src/components/accessibility/"],
  },
  {
    id: 18,
    slug: "produccion",
    title: "Producción",
    goal: "Docker, CI/CD, health probes, backup pg_dump, uptime cron.",
    status: "completed",
    commits: ["4603631", "306447f"],
    docs: ["docs/PRODUCTION.md"],
    keyPaths: ["Dockerfile", "docker-compose.yml", ".github/workflows/"],
  },
  {
    id: 19,
    slug: "testing",
    title: "Testing 90%",
    goal: "Cobertura core lib, Playwright E2E, RLS estático, benchmarks.",
    status: "completed",
    commits: ["fa0147f"],
    docs: ["docs/TESTING.md"],
    keyPaths: ["tests/coverage-scope.ts", "e2e/smoke.spec.ts", "playwright.config.ts"],
  },
  {
    id: 20,
    slug: "roadmap",
    title: "Cierre del roadmap",
    goal: "Documentar las 20 fases, decisiones, commits y checklist de entrega.",
    status: "completed",
    docs: ["docs/ENTERPRISE_TRANSFORMATION.md"],
    keyPaths: ["src/lib/enterprise/phases.ts"],
  },
];

export const ENTERPRISE_PHASE_COUNT = 20;

export function getCompletedPhases(): EnterprisePhase[] {
  return ENTERPRISE_PHASES.filter((p) => p.status === "completed");
}

export function getPhaseById(id: number): EnterprisePhase | undefined {
  return ENTERPRISE_PHASES.find((p) => p.id === id);
}

export function isEnterpriseRoadmapComplete(): boolean {
  return ENTERPRISE_PHASES.every((p) => p.status === "completed" || p.status === "audit");
}
