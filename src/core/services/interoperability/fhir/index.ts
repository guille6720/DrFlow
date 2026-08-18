export { mapClinicalSnapshotToFhirBundle } from "@/core/services/interoperability/fhir/map-to-fhir";
export { mergeFhirPatientBundles } from "@/core/services/interoperability/fhir/merge-fhir-bundles";
export {
  type FhirImportDraft,
  type FhirImportPatientDraft,
  parseFhirImportDraft,
  parseFhirJson,
} from "@/core/services/interoperability/fhir/parse-from-fhir";
export {
  collectBundleResources,
  FHIR_DNI_SYSTEM,
  FHIR_ICD10_SYSTEM,
  FHIR_R4_VERSION,
  type FhirBundle,
  type FhirResource,
  splitBundleByType,
} from "@/core/services/interoperability/fhir/types";
