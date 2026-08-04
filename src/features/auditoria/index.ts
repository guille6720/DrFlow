export { PatientClinicalAuditPanel } from "@/features/pacientes/components/pacientes/patient-clinical-audit-panel";
export { loadPatientAuditTrail } from "@/features/pacientes/server/load-patient-audit-trail";
export {
  auditActionLabel,
  auditEntityLabel,
  mergePatientAuditEvents,
  sanitizeAuditSnapshot,
  type PatientAuditEvent,
} from "@/core/security/audit-types";
