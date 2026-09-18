export {
  notConfiguredOfficialRefepsProfessionalAdapter,
  resolveProfessionalValidationAdapter,
  sandboxRefepsProfessionalAdapter,
} from "@/core/renapdis/adapters";
export type { CuirComponents, CuirStatus, CuirValidationResult } from "@/core/renapdis/cuir";
export {
  buildSandboxCuirComponents,
  CUIR_STATUSES,
  formatCuir,
  formatOfficialCuir,
  formatSandboxCuirDebug,
  isOfficialCuirString,
  parseCuir,
  parseOfficialCuir,
  parseSandboxCuirDebug,
  resolveCuirEnvironment,
  resolveIndecJurisdictionCode,
  resolveOfficialTypeSubtypeCode,
  SANDBOX_CUIR_PLATFORM_PLACEHOLDER,
  SANDBOX_CUIR_REPOSITORY_PLACEHOLDER,
  serializeOfficialItemNumber,
  validateCuirComponents,
  validateOfficialCuirComponents,
} from "@/core/renapdis/cuir";
export {
  externalOutageUserMessage,
  getRefepsDependencyStatus,
  isRefepsForcedOutage,
  nationalSubmitBlockedByOutage,
} from "@/core/renapdis/external-outage";
export type {
  NationalReadyGateInput,
  NationalReadyGateResult,
  NationalRxStatus,
} from "@/core/renapdis/national-ready-gate";
export { evaluateNationalReadyGate } from "@/core/renapdis/national-ready-gate";
export type { ReadinessItem, ReadinessState } from "@/core/renapdis/operational-readiness";
export {
  getRenapdisOperationalReadiness,
  isReadinessState,
  OPS_ALERT_THRESHOLDS,
  READINESS_STATES,
} from "@/core/renapdis/operational-readiness";
export type {
  PatientIdentityInput,
  PatientIdentityIssue,
  PatientIdentityValidationResult,
} from "@/core/renapdis/patient-identity";
export {
  evaluatePatientIdentityForNationalRx,
  evaluatePatientIdentitySoft,
  formatCuilDisplay,
  isWellFormedCuil,
  normalizeCuilDigits,
} from "@/core/renapdis/patient-identity";
export { prepareNationalRxArtifacts } from "@/core/renapdis/prepare-national-rx";
export { evaluatePrescriptionIssueGate } from "@/core/renapdis/prescription-issue-gate";
export type { MedicationSubtype, PrescriptionCategory } from "@/core/renapdis/prescription-types";
export {
  isPrescriptionCategory,
  mapLegacyPrescriptionTypeToCategory,
  mapLegacyPrescriptionTypeToSubtype,
  MEDICATION_SUBTYPES,
  PRESCRIPTION_CATEGORIES,
  PRESCRIPTION_CATEGORY_LABELS,
} from "@/core/renapdis/prescription-types";
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
