/**
 * Phase 27 — Compliance database migrations (132–137) posture.
 * Staging/local only. DO NOT execute production migrations from this module.
 * Not legal advice.
 */

export const COMPLIANCE_MIGRATIONS_PRODUCTION_FORBIDDEN =
  "DO NOT execute production migrations" as const;

export type ComplianceMigrationId =
  | "132_audit_log_security"
  | "133_tenant_isolation_public_api"
  | "134_consent_management"
  | "135_privacy_rights_requests"
  | "136_storage_security"
  | "137_subscription_cancellation";

export type ComplianceMigrationEntry = {
  id: ComplianceMigrationId;
  file: string;
  rollbackFile: string;
  phase: string;
  additive: boolean;
  /** Reasonable reverse available (not always bit-perfect). */
  reversible: "yes" | "partial" | "function_only";
  legacyCompatible: boolean;
  damagesExistingClinicsIfAppliedCorrectly: false;
  rlsImpact: string;
  notes: string;
};

export const COMPLIANCE_MIGRATIONS_132_137: ComplianceMigrationEntry[] = [
  {
    id: "132_audit_log_security",
    file: "supabase/migrations/132_audit_log_security.sql",
    rollbackFile: "supabase/migrations/rollback/132_audit_log_security.down.sql",
    phase: "9 / compliance audit",
    additive: true,
    reversible: "yes",
    legacyCompatible: true,
    damagesExistingClinicsIfAppliedCorrectly: false,
    rlsImpact: "Tightens clinical_record_audit INSERT; REVOKE update/delete",
    notes: "Triggers + policy; no table drop of clinic data.",
  },
  {
    id: "133_tenant_isolation_public_api",
    file: "supabase/migrations/133_tenant_isolation_public_api.sql",
    rollbackFile: "supabase/migrations/rollback/133_tenant_isolation_public_api.down.sql",
    phase: "10",
    additive: false,
    reversible: "partial",
    legacyCompatible: true,
    damagesExistingClinicsIfAppliedCorrectly: false,
    rlsImpact: "SECURITY DEFINER api_* gated by clinic membership",
    notes:
      "Reemplaza cuerpos de RPC. Rollback parcial: quita gate; restaurar firmas previas requiere git history.",
  },
  {
    id: "134_consent_management",
    file: "supabase/migrations/134_consent_management.sql",
    rollbackFile: "supabase/migrations/rollback/134_consent_management.down.sql",
    phase: "11",
    additive: true,
    reversible: "partial",
    legacyCompatible: true,
    damagesExistingClinicsIfAppliedCorrectly: false,
    rlsImpact: "Immutability trigger + policies on consent_records",
    notes: "Columnas nuevas; patient_id nullable. Rollback dropea columnas/índices con cuidado.",
  },
  {
    id: "135_privacy_rights_requests",
    file: "supabase/migrations/135_privacy_rights_requests.sql",
    rollbackFile: "supabase/migrations/rollback/135_privacy_rights_requests.down.sql",
    phase: "12",
    additive: true,
    reversible: "yes",
    legacyCompatible: true,
    damagesExistingClinicsIfAppliedCorrectly: false,
    rlsImpact: "Nueva tabla con RLS ENABLE + policies",
    notes: "Cola ARCO; no borra pacientes/HC.",
  },
  {
    id: "136_storage_security",
    file: "supabase/migrations/136_storage_security.sql",
    rollbackFile: "supabase/migrations/rollback/136_storage_security.down.sql",
    phase: "14",
    additive: false,
    reversible: "partial",
    legacyCompatible: true,
    damagesExistingClinicsIfAppliedCorrectly: false,
    rlsImpact: "Storage policies path-aware; bucket public=false",
    notes: "No muda filas clínicas; endurece bucket/policies.",
  },
  {
    id: "137_subscription_cancellation",
    file: "supabase/migrations/137_subscription_cancellation.sql",
    rollbackFile: "supabase/migrations/rollback/137_subscription_cancellation.down.sql",
    phase: "21",
    additive: false,
    reversible: "function_only",
    legacyCompatible: true,
    damagesExistingClinicsIfAppliedCorrectly: false,
    rlsImpact: "Actualiza clinic_subscription_active (acceso paid-through)",
    notes: "Solo REPLACE FUNCTION; no altera filas. Rollback restaura definición pre-137.",
  },
];

export const STAGING_APPLY_COMMANDS = [
  "npm run supabase:preflight:staging",
  "npm run entitlements:db-push:dry-run  # o supabase db push --dry-run hacia staging",
  "ALLOW_STAGING_DB_PUSH=1 CONFIRM_STAGING_DB_PUSH=<staging-ref> npm run supabase:db-push:staging",
  "npm run compliance:migrations:verify-staging",
] as const;

export type DatabaseMigrationsPosture = {
  migrationCount: number;
  productionMigrationsForbidden: true;
  productionForbiddenBanner: typeof COMPLIANCE_MIGRATIONS_PRODUCTION_FORBIDDEN;
  allLegacyCompatible: boolean;
  noneDamageClinicsWhenAppliedCorrectly: true;
  stagingVerifyScript: string;
  notes: string[];
};

export function evaluateDatabaseMigrationsPosture(): DatabaseMigrationsPosture {
  return {
    migrationCount: COMPLIANCE_MIGRATIONS_132_137.length,
    productionMigrationsForbidden: true,
    productionForbiddenBanner: COMPLIANCE_MIGRATIONS_PRODUCTION_FORBIDDEN,
    allLegacyCompatible: COMPLIANCE_MIGRATIONS_132_137.every((m) => m.legacyCompatible),
    noneDamageClinicsWhenAppliedCorrectly: true,
    stagingVerifyScript: "scripts/verify-compliance-migrations-staging.mjs",
    notes: [
      "Aplicar solo en staging/local con gates ALLOW_STAGING_DB_PUSH.",
      "Rollbacks en supabase/migrations/rollback/*.down.sql",
      COMPLIANCE_MIGRATIONS_PRODUCTION_FORBIDDEN,
    ],
  };
}
