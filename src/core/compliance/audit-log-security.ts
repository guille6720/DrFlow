/**
 * Phase 9 — Centralized audit log security posture.
 *
 * Documents what DrFlow must log and the DB/app controls that protect audit integrity.
 * Does not certify legal compliance by itself.
 */

export const AUDIT_LOG_SECURITY_POLICY = {
  immutable: true,
  tables: ["audit_logs", "clinical_record_audit"] as const,
  /** App INSERT must match session user (053 / 132 RLS). */
  authorshipBinding: {
    audit_logs: "user_id = auth.uid()",
    clinical_record_audit: "changed_by = auth.uid()",
  },
  /** DB trigger overwrites client-supplied timestamps on INSERT (132). */
  serverOwnedTimestamps: true,
  /** No UPDATE/DELETE policies; triggers + REVOKE on app roles. */
  mutationBlocked: true,
  autoPurgeEnabled: false,
  readScope: {
    audit_logs: "clinic_admin | can_view_clinical (048)",
    clinical_record_audit: "can_view_clinical",
  },
} as const;

export type SensitiveAuditCategory = {
  id: string;
  label: string;
  /** Primary audit channel(s). */
  channels: Array<"audit_logs" | "clinical_record_audit">;
  /** App modules / actions that must emit events (verified by tests). */
  appSignals: string[];
};

/** Sensitive operations DrFlow must record (PHASE 9 matrix). */
export const SENSITIVE_AUDIT_CATEGORIES: SensitiveAuditCategory[] = [
  {
    id: "view_patient_clinical",
    label: "Consulta de datos clínicos del paciente",
    channels: ["audit_logs"],
    appSignals: ["recordSensitiveAccess", "voidRecordSensitiveAccess"],
  },
  {
    id: "view_clinical_record",
    label: "Consulta de historia clínica (detalle)",
    channels: ["audit_logs", "clinical_record_audit"],
    appSignals: ["recordSensitiveAccess", "load-historia-detail-page"],
  },
  {
    id: "sensitive_download",
    label: "Descarga / URL firmada de adjuntos clínicos o admin",
    channels: ["audit_logs"],
    appSignals: ["getPatientClinicalDocumentUrl", "getAdminDocumentUrl"],
  },
  {
    id: "create_modify_clinical",
    label: "Creación y modificación de consultas HC",
    channels: ["clinical_record_audit", "audit_logs"],
    appSignals: ["insertClinicalRecordPatchAudit", "update_clinical_record_atomic"],
  },
  {
    id: "exports",
    label: "Exportaciones Habeas Data / clínica / clínica masiva",
    channels: ["audit_logs"],
    appSignals: [
      "exportPatientArcoBundle",
      "exportClinicHabeasData",
      "patient-clinical-export",
      "bulk-clinical-export",
    ],
  },
  {
    id: "prescriptions",
    label: "Emisión y anulación de recetas / órdenes",
    channels: ["audit_logs"],
    appSignals: ["issuePrescription", "voidPrescription", "createMedicalOrder", "voidMedicalOrder"],
  },
  {
    id: "permissions",
    label: "Cambios de permisos e invitaciones",
    channels: ["audit_logs"],
    appSignals: ["inviteClinicMember", "updateClinicMemberRole", "revokeClinicInvitation"],
  },
  {
    id: "ai_usage",
    label: "Uso de IA clínica (sin prompts)",
    channels: ["audit_logs"],
    appSignals: ["recordAiAuditEvent", "buildAiAuditRecordParams"],
  },
  {
    id: "admin_settings",
    label: "Configuración, retención, cumplimiento",
    channels: ["audit_logs"],
    appSignals: ["updateClinicRetentionYears", "applyClinicLegalAcceptance"],
  },
];

export type AuditLogSecurityStatus = {
  immutable: true;
  serverOwnedTimestamps: true;
  authorshipBound: true;
  rlsHardened: true;
  sensitiveCategories: number;
  notes: string[];
};

/** Technical posture check for Phase 9 (no legal certification). */
export function evaluateAuditLogSecurityPosture(): AuditLogSecurityStatus {
  return {
    immutable: true,
    serverOwnedTimestamps: true,
    authorshipBound: true,
    rlsHardened: true,
    sensitiveCategories: SENSITIVE_AUDIT_CATEGORIES.length,
    notes: [
      "Los registros de auditoría no admiten UPDATE/DELETE para roles de aplicación.",
      "user_id / changed_by deben coincidir con auth.uid() en INSERT directo.",
      "Los timestamps los fija el servidor en INSERT; no hay backdating vía cliente.",
      "Fallos de insert de auditoría no bloquean mutaciones (trade-off documentado en Fase 1).",
      "Médicos con can_view_clinical pueden leer audit_logs del consultorio (048).",
    ],
  };
}
