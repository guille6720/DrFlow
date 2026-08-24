export const FHIR_R4_VERSION = "4.0.1";

/** Argentine national ID. Used as Patient.identifier.system — not an internal UUID. */
export const FHIR_DNI_SYSTEM = "http://www.renaper.gob.ar/dni";

export const FHIR_ICD10_SYSTEM = "http://hl7.org/fhir/sid/icd-10";

export const FHIR_LOINC_SYSTEM = "http://loinc.org";

export const FHIR_INSURANCE_SYSTEM_PREFIX = "https://drflow.app/fhir/insurance/";

export type FhirResourceType =
  | "Bundle"
  | "Patient"
  | "Practitioner"
  | "Encounter"
  | "Condition"
  | "Observation"
  | "AllergyIntolerance"
  | "MedicationRequest"
  | "DiagnosticReport"
  | "DocumentReference";

export type FhirCodeableConcept = {
  coding?: Array<{ system?: string; code?: string; display?: string }>;
  text?: string;
};

export type FhirReference = {
  reference?: string;
  display?: string;
};

export type FhirResource = {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
};

export type FhirBundleEntry = {
  fullUrl?: string;
  resource: FhirResource;
};

export type FhirBundle = {
  resourceType: "Bundle";
  type: "collection" | "transaction" | "document";
  timestamp?: string;
  total?: number;
  meta?: { profile?: string[] };
  entry?: FhirBundleEntry[];
};

export function fhirReference(resourceType: string, id: string, display?: string): FhirReference {
  return display
    ? { reference: `${resourceType}/${id}`, display }
    : { reference: `${resourceType}/${id}` };
}

export function fhirTextConcept(text: string, coding?: FhirCodeableConcept["coding"]): FhirCodeableConcept {
  return coding?.length ? { text, coding } : { text };
}

export function readCodeableText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const concept = value as FhirCodeableConcept;
  const text = concept.text?.trim();
  if (text) return text;
  const display = concept.coding?.find((item) => item.display?.trim())?.display?.trim();
  return display ?? "";
}

export function collectBundleResources(bundle: FhirBundle): FhirResource[] {
  return (bundle.entry ?? [])
    .map((item) => item.resource)
    .filter((resource): resource is FhirResource => Boolean(resource?.resourceType));
}

export function resourcesOfType<T extends FhirResource>(
  resources: FhirResource[],
  resourceType: FhirResourceType
): T[] {
  return resources.filter((resource) => resource.resourceType === resourceType) as T[];
}

export function localResourceId(resourceType: string, index: number): string {
  return `${resourceType.toLowerCase()}-${index}`;
}

export function splitBundleByType(bundle: FhirBundle): Record<string, FhirBundle> {
  const grouped = new Map<string, FhirResource[]>();
  for (const resource of collectBundleResources(bundle)) {
    const list = grouped.get(resource.resourceType) ?? [];
    list.push(resource);
    grouped.set(resource.resourceType, list);
  }
  const result: Record<string, FhirBundle> = {};
  for (const [type, list] of grouped) {
    result[type] = {
      resourceType: "Bundle",
      type: "collection",
      timestamp: bundle.timestamp,
      total: list.length,
      entry: list.map((resource) => ({
        fullUrl: resource.id ? `${type}/${resource.id}` : undefined,
        resource,
      })),
    };
  }
  return result;
}
