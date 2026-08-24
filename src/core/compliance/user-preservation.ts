/**
 * Phase 29 — Do not break current users.
 * Existing legitimate clinics must retain data and access.
 * Forbidden without explicit approval: delete clinics/patients, reset subscriptions,
 * change owners, strip permissions, destroy clinical records.
 * Not legal advice.
 */

export const USER_PRESERVATION_EXPLICIT_APPROVAL_REQUIRED =
  "without explicit approval" as const;

export type ForbiddenUserBreakageId =
  | "delete_clinics"
  | "delete_patients"
  | "reset_subscriptions"
  | "change_owners"
  | "remove_legitimate_permissions"
  | "destroy_clinical_records";

export type ForbiddenUserBreakage = {
  id: ForbiddenUserBreakageId;
  label: string;
  sqlSmell: RegExp;
  notes: string;
};

/** Patterns that must not appear in compliance forward migrations 132–137. */
export const FORBIDDEN_USER_BREAKAGE: ForbiddenUserBreakage[] = [
  {
    id: "delete_clinics",
    label: "Delete clinics",
    sqlSmell: /\bDELETE\s+FROM\s+(public\.)?clinics\b/i,
    notes: "No mass/row delete of clinics in compliance migrations.",
  },
  {
    id: "delete_patients",
    label: "Delete patients",
    sqlSmell: /\bDELETE\s+FROM\s+(public\.)?patients\b/i,
    notes: "No mass/row delete of patients in compliance migrations.",
  },
  {
    id: "reset_subscriptions",
    label: "Reset subscriptions",
    sqlSmell:
      /\b(TRUNCATE\s+(TABLE\s+)?(public\.)?clinic_subscriptions|DELETE\s+FROM\s+(public\.)?clinic_subscriptions|UPDATE\s+(public\.)?clinic_subscriptions\s+SET\s+status\s*=)/i,
    notes: "137 only REPLACE FUNCTION; no bulk subscription reset.",
  },
  {
    id: "change_owners",
    label: "Change owners",
    sqlSmell:
      /\bUPDATE\s+(public\.)?(clinics|clinic_members|profiles)\s+SET\s+(owner|created_by|user_id|role)\s*=/i,
    notes: "No ownership/role rewrite in 132–137.",
  },
  {
    id: "remove_legitimate_permissions",
    label: "Remove legitimate permissions",
    sqlSmell:
      /\bDELETE\s+FROM\s+(public\.)?(clinic_members|member_permissions|clinic_permissions)\b/i,
    notes: "No stripping memberships/permissions.",
  },
  {
    id: "destroy_clinical_records",
    label: "Destroy clinical records",
    sqlSmell:
      /\b(DELETE\s+FROM\s+(public\.)?clinical_records|TRUNCATE\s+(TABLE\s+)?(public\.)?clinical_records)\b/i,
    notes: "HC remains; privacy queue does not hard-delete HC.",
  },
];

export const COMPLIANCE_FORWARD_MIGRATIONS_PRESERVATION = [
  "supabase/migrations/132_audit_log_security.sql",
  "supabase/migrations/133_tenant_isolation_public_api.sql",
  "supabase/migrations/134_consent_management.sql",
  "supabase/migrations/135_privacy_rights_requests.sql",
  "supabase/migrations/136_storage_security.sql",
  "supabase/migrations/137_subscription_cancellation.sql",
] as const;

export type UserPreservationPosture = {
  existingClinicsMustRetainAccess: true;
  forbiddenWithoutApproval: ForbiddenUserBreakageId[];
  productionDestructiveMigrationsForbidden: true;
  notes: string[];
};

export function evaluateUserPreservationPosture(): UserPreservationPosture {
  return {
    existingClinicsMustRetainAccess: true,
    forbiddenWithoutApproval: FORBIDDEN_USER_BREAKAGE.map((f) => f.id),
    productionDestructiveMigrationsForbidden: true,
    notes: [
      "Forward 132–137 are additive/replace-function/policy — no clinic/patient/HC deletes.",
      "Self-serve cancel is opt-in per clinic admin; not a bulk subscription reset.",
      "API tenant gate may block illegitimate cross-clinic calls; same-clinic access remains.",
      "Rollback 135 drops privacy_rights_requests only (new table), not clinical data.",
    ],
  };
}

export function findForbiddenBreakageInSql(sql: string): ForbiddenUserBreakageId[] {
  const hits: ForbiddenUserBreakageId[] = [];
  const withoutComments = sql
    .replace(/--[^\n]*/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  for (const item of FORBIDDEN_USER_BREAKAGE) {
    if (item.sqlSmell.test(withoutComments)) {
      hits.push(item.id);
    }
  }
  return hits;
}
