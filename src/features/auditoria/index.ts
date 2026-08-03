export { PatientClinicalAuditPanel } from "@/components/pacientes/patient-clinical-audit-panel";
export { loadPatientAuditTrail } from "@/lib/server/load-patient-audit-trail";
export {
  auditActionLabel,
  auditEntityLabel,
  mergePatientAuditEvents,
  sanitizeAuditSnapshot,
  type PatientAuditEvent,
} from "@/lib/security/audit-types";
