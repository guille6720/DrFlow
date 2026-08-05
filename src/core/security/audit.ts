export {
  auditActionLabel,
  auditEntityLabel,
  mergePatientAuditEvents,
  sanitizeAuditSnapshot,
  type AuditAction,
  type PatientAuditEvent,
} from "@/core/security/audit-types";
export { getAuditRequestContext, type AuditRequestContext } from "@/core/security/audit-context";
export { recordAudit, recordAuditChange, type RecordAuditParams } from "@/core/security/audit-service";
export {
  auditFieldChanges,
  buildAuditLogRow,
  buildClinicalRecordAuditRow,
  deriveAuditModule,
  type AuditModule,
} from "@/core/security/audit-log";
