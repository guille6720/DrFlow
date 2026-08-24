import {
  collectBundleResources,
  FHIR_R4_VERSION,
  type FhirBundle,
  type FhirResource,
} from "@/core/services/interoperability/fhir/types";

const REFERENCE_RE =
  /"(Patient|Practitioner|Encounter|Condition|Observation|AllergyIntolerance|MedicationRequest|DiagnosticReport|DocumentReference)\/([A-Za-z0-9._-]+)"/g;

function prefixResources(resources: FhirResource[], prefix: string): FhirResource[] {
  const json = JSON.stringify(resources).replace(
    REFERENCE_RE,
    (_match, type: string, id: string) => `"${type}/${prefix}${id}"`
  );
  const parsed = JSON.parse(json) as FhirResource[];
  return parsed.map((resource) => ({
    ...resource,
    id: resource.id ? `${prefix}${resource.id}` : resource.id,
  }));
}

/** Merge per-patient collection bundles into one clinic-scoped FHIR R4 Bundle. */
export function mergeFhirPatientBundles(bundles: FhirBundle[]): FhirBundle {
  const resources: FhirResource[] = [];
  bundles.forEach((bundle, index) => {
    const prefix = `p${index + 1}-`;
    resources.push(...prefixResources(collectBundleResources(bundle), prefix));
  });
  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    total: resources.length,
    meta: { profile: [`https://hl7.org/fhir/${FHIR_R4_VERSION}/Bundle`] },
    entry: resources.map((resource) => ({
      fullUrl: resource.id ? `${resource.resourceType}/${resource.id}` : undefined,
      resource,
    })),
  };
}
