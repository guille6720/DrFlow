/**
 * Phase 10 — Multi-tenant isolation posture (clinic_id boundary).
 *
 * A cross-tenant data leak is a monetization BLOCKER.
 * This module centralizes the audit matrix and technical evaluation helpers.
 * Does not certify legal compliance by itself.
 */

export const TENANT_BOUNDARY = "clinic_id" as const;

export type TenantSurface =
  | "sql_rls"
  | "rpc_security_definer"
  | "server_actions"
  | "api_routes"
  | "storage_signed_urls"
  | "exports"
  | "ai_endpoints"
  | "admin_service_role"
  | "public_api";

export type TenantIsolationCheck = {
  id: string;
  surface: TenantSurface;
  label: string;
  /** App / SQL signals verified by automated tests. */
  signals: string[];
  severityIfBroken: "blocker" | "high" | "medium";
};

/** Surfaces that must keep Clinic A from reading Clinic B. */
export const TENANT_ISOLATION_CHECKS: TenantIsolationCheck[] = [
  {
    id: "rls_core_phi",
    surface: "sql_rls",
    label: "RLS en tablas clínicas y PHI (patients, HC, adjuntos, auditoría)",
    signals: ["TABLES_REQUIRING_RLS", "ENABLE ROW LEVEL SECURITY", "user_clinic_ids"],
    severityIfBroken: "blocker",
  },
  {
    id: "app_tenant_scope",
    surface: "server_actions",
    label: "Defense-in-depth app: assertSameClinic / ownership-guard / storage path",
    signals: [
      "assertSameClinic",
      "verifyPatientInClinic",
      "assertStoragePathInClinic",
      "requireResourceInClinic",
    ],
    severityIfBroken: "blocker",
  },
  {
    id: "public_api_rpc_gate",
    surface: "public_api",
    label: "RPCs api_* SECURITY DEFINER con assert_public_api_clinic_access",
    signals: ["assert_public_api_clinic_access", "api_list_appointments", "api_submit_appointment"],
    severityIfBroken: "blocker",
  },
  {
    id: "public_api_key_binding",
    surface: "public_api",
    label: "Clave API ligada a clinic_id; rutas usan auth.clinicId",
    signals: ["authenticatePublicApiKey", "auth.clinicId", "p_clinic_id: auth.clinicId"],
    severityIfBroken: "blocker",
  },
  {
    id: "api_session_routes",
    surface: "api_routes",
    label: "Rutas /api autenticadas exigen clínica activa",
    signals: ["getActiveClinicId", "patients/search", "clinical-ai"],
    severityIfBroken: "blocker",
  },
  {
    id: "ai_patient_scope",
    surface: "ai_endpoints",
    label: "IA clínica carga pacientes con clinic_id de sesión",
    signals: ["loadPatientKnownIdentifiers", "eq(\"clinic_id\", clinicId)"],
    severityIfBroken: "blocker",
  },
  {
    id: "storage_path_prefix",
    surface: "storage_signed_urls",
    label: "Paths de storage con prefijo {clinic_id}/ + assert en firmas",
    signals: ["assertStoragePathInClinic", "buildExportStagingPath", "createSignedUrl"],
    severityIfBroken: "blocker",
  },
  {
    id: "exports_ownership",
    surface: "exports",
    label: "Exportaciones verifican paciente/clínica antes de empaquetar",
    signals: ["verifyPatientInClinic", "buildBulkClinicalExport", "signExportStagingPath"],
    severityIfBroken: "blocker",
  },
  {
    id: "service_role_discipline",
    surface: "admin_service_role",
    label: "Admin client solo con filtros clinic_id o gates (jobs, reset, billing)",
    signals: ["createAdminClient", "eq(\"clinic_id\"", "job.clinic_id"],
    severityIfBroken: "high",
  },
];

export type TenantIsolationStatus = {
  boundary: typeof TENANT_BOUNDARY;
  checkCount: number;
  blockerSurfaces: number;
  notes: string[];
};

export function evaluateTenantIsolationPosture(): TenantIsolationStatus {
  const blockerSurfaces = TENANT_ISOLATION_CHECKS.filter(
    (c) => c.severityIfBroken === "blocker"
  ).length;
  return {
    boundary: TENANT_BOUNDARY,
    checkCount: TENANT_ISOLATION_CHECKS.length,
    blockerSurfaces,
    notes: [
      "Límite de tenant: clinic_id (consultorio).",
      "RLS es la línea primaria; ownership-guard / tenant-scope son defense-in-depth.",
      "Service role bypasea RLS — toda vía admin debe filtrar por clinic_id o gate explícito.",
      "RPCs api_* requieren assert_public_api_clinic_access (migración 133).",
      "Tests JWT reales siguen siendo opcionales (DRFLOW_RLS_INTEGRATION=1) — ejecutar en staging antes de producción.",
    ],
  };
}

/** Pure helper used by tests — simulates Clinic A vs Clinic B mismatch. */
export function wouldCrossTenantLeak(
  activeClinicId: string,
  resourceClinicId: string | null | undefined
): boolean {
  if (!resourceClinicId) return true;
  return resourceClinicId !== activeClinicId;
}
