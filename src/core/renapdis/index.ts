export {
  notConfiguredOfficialRefepsProfessionalAdapter,
  resolveProfessionalValidationAdapter,
  sandboxRefepsProfessionalAdapter,
} from "@/core/renapdis/adapters";
export { evaluatePrescriptionIssueGate } from "@/core/renapdis/prescription-issue-gate";
export type {
  PrescriberIdentityInput,
  PrescriberValidationIssue,
  PrescriberValidationIssueCode,
  RefepsProfessionalValidationAdapter,
  RefepsValidationStatus,
  ValidatePrescriberResult,
} from "@/core/renapdis/types";
export {
  allowsNationalElectronicPrescription,
  hasAnyProfessionalLicense,
  isRefepsValidationStatus,
  REFEPS_STATUSES_ALLOWING_NATIONAL_RX,
  REFEPS_VALIDATION_STATUSES,
  resolveEffectiveCuil,
} from "@/core/renapdis/types";
export {
  collectLocalIdentityIssues,
  evaluateNationalPrescriptionEligibility,
  loadProfessionalForValidation,
  mapProfessionalToIdentityInput,
  validatePrescriber,
} from "@/core/renapdis/validate-prescriber";
