import {
  collectBundleResources,
  FHIR_DNI_SYSTEM,
  type FhirBundle,
  type FhirResource,
  readCodeableText,
} from "@/core/services/interoperability/fhir/types";

import {
  normalizeDocumentNumber,
  type NormalizedPatientImportRow,
  normalizeEmail,
  normalizePhone,
} from "@/features/integraciones/lib/patient-import-normalize";

export type FhirImportEncounter = {
  localKey: string;
  date: string | null;
  professionalName: string | null;
  chiefComplaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
};

export type FhirImportPatientDraft = {
  localId: string;
  demographics: NormalizedPatientImportRow;
  allergies: string | null;
  medicalHistory: string | null;
  regularMedication: string | null;
  encounters: FhirImportEncounter[];
};

export type FhirImportDraft = {
  patients: FhirImportPatientDraft[];
  warnings: string[];
  issues: string[];
  resourceCounts: Record<string, number>;
};

const HISTORY_CODES = new Set(["11348-0", "history", "antecedentes"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resourceRef(value: unknown): string {
  const record = asRecord(value);
  const reference = readString(record?.reference);
  return reference.replace(/^urn:uuid:/, "");
}

function resourceKey(resource: FhirResource): string {
  if (resource.id) return `${resource.resourceType}/${resource.id}`;
  return resource.resourceType;
}

function readHumanName(value: unknown): { family: string; given: string } {
  const names = asArray(value);
  const first = asRecord(names[0]) ?? asRecord(value);
  const family = readString(first?.family) || readString(first?.text).split(",")[0];
  const givenList = asArray(first?.given).map(readString).filter(Boolean);
  const given = givenList.join(" ") || readString(first?.text).split(",")[1];
  return { family: family.trim(), given: given.trim() };
}

function readDni(resource: FhirResource): string | null {
  for (const raw of asArray(resource.identifier)) {
    const identifier = asRecord(raw);
    if (!identifier) continue;
    const system = readString(identifier.system).toLowerCase();
    const typeText = readCodeableText(identifier.type).toLowerCase();
    const value = readString(identifier.value);
    const looksDni =
      system.includes("dni") ||
      system.includes("renaper") ||
      system === FHIR_DNI_SYSTEM ||
      typeText.includes("dni") ||
      typeText === "ni";
    const normalized = normalizeDocumentNumber(value);
    if (looksDni && normalized) return normalized;
    if (!looksDni && normalized && asArray(resource.identifier).length === 1) return normalized;
  }
  return null;
}

function readTelecom(resource: FhirResource, system: string): string | null {
  for (const raw of asArray(resource.telecom)) {
    const item = asRecord(raw);
    if (readString(item?.system) === system) {
      return system === "email"
        ? normalizeEmail(readString(item?.value))
        : normalizePhone(readString(item?.value));
    }
  }
  return null;
}

function readDisplayName(value: unknown): string {
  const record = asRecord(value);
  if (!record) return "";
  const parsed = readHumanName(record.name ?? value);
  if (parsed.family && parsed.given) return `${parsed.family}, ${parsed.given}`;
  return parsed.family || parsed.given || readString(asRecord(asArray(record.name)[0])?.text);
}

function resolvePractitionerName(
  participant: Record<string, unknown> | null,
  byKey: Map<string, FhirResource>
): string | null {
  const individual = asRecord(participant?.individual);
  const display = readString(individual?.display);
  if (display) return display;
  const reference = resourceRef(individual);
  if (!reference) return null;
  const direct = byKey.get(reference);
  if (direct) return readDisplayName(direct) || null;
  for (const [key, resource] of byKey) {
    if (resource.resourceType !== "Practitioner") continue;
    if (key.endsWith(`/${reference}`) || key === reference || resource.id === reference) {
      return readDisplayName(resource) || null;
    }
  }
  return null;
}

function wrapAsBundle(payload: unknown): FhirBundle | null {
  const root = asRecord(payload);
  if (!root) return null;
  if (root.resourceType === "Bundle") return root as FhirBundle;
  if (typeof root.resourceType === "string") {
    return { resourceType: "Bundle", type: "collection", entry: [{ resource: root as FhirResource }] };
  }
  return null;
}

export function parseFhirJson(raw: string): { ok: true; bundle: FhirBundle } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "El archivo no es un JSON válido." };
  }
  const bundle = wrapAsBundle(parsed);
  if (!bundle) return { ok: false, error: "Se espera un Bundle FHIR R4 o un recurso Patient." };
  return { ok: true, bundle };
}

export function parseFhirImportDraft(bundle: FhirBundle): FhirImportDraft {
  const resources = collectBundleResources(bundle);
  const warnings: string[] = [];
  const issues: string[] = [];
  const resourceCounts: Record<string, number> = {};
  for (const resource of resources) {
    resourceCounts[resource.resourceType] = (resourceCounts[resource.resourceType] ?? 0) + 1;
  }

  const byKey = new Map(resources.map((resource) => [resourceKey(resource), resource]));
  const patients: FhirImportPatientDraft[] = [];
  let line = 1;

  for (const resource of resources.filter((item) => item.resourceType === "Patient")) {
    const name = readHumanName(resource.name);
    const dni = readDni(resource);
    if (!dni || !name.family || !name.given) {
      issues.push(`Patient ${resource.id ?? line}: falta DNI, apellido o nombre. No se inventan datos.`);
      continue;
    }
    const localId = resource.id ? `Patient/${resource.id}` : `Patient/${line}`;
    patients.push({
      localId,
      demographics: {
        lineNumber: line,
        document_number: dni,
        last_name: name.family,
        first_name: name.given,
        birth_date: readString(resource.birthDate).slice(0, 10) || null,
        phone: readTelecom(resource, "phone"),
        email: readTelecom(resource, "email"),
        address: readString(asRecord(asArray(resource.address)[0])?.text) || null,
        insurance_provider: null,
        insurance_plan: null,
        insurance_number: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
      },
      allergies: null,
      medicalHistory: null,
      regularMedication: null,
      encounters: [],
    });
    line += 1;
  }

  const byPatientRef = new Map(patients.map((item) => [item.localId, item]));
  const only = patients.length === 1 ? patients[0] : null;

  function resolvePatient(subject: unknown): FhirImportPatientDraft | null {
    const reference = resourceRef(subject);
    if (reference && byPatientRef.has(reference)) return byPatientRef.get(reference) ?? null;
    if (reference) {
      const match = [...byPatientRef.keys()].find((key) => key.endsWith(`/${reference}`) || key === reference);
      if (match) return byPatientRef.get(match) ?? null;
    }
    return only;
  }

  for (const resource of resources) {
    const patient = resolvePatient(resource.patient ?? resource.subject);
    if (!patient) {
      if (resource.resourceType !== "Patient" && resource.resourceType !== "Practitioner" && resource.resourceType !== "Bundle") {
        warnings.push(`${resource.resourceType} ${resource.id ?? ""} sin paciente asociado; se omite.`);
      }
      continue;
    }

    if (resource.resourceType === "AllergyIntolerance") {
      const text = readCodeableText(resource.code);
      if (text) patient.allergies = patient.allergies ? `${patient.allergies}; ${text}` : text;
    } else if (resource.resourceType === "Observation") {
      const code = readCodeableText(resource.code).toLowerCase();
      const value =
        readString(resource.valueString) ||
        readString(asRecord(resource.valueQuantity)?.value) ||
        readCodeableText(resource.valueCodeableConcept);
      if (!value) continue;
      const loinc = asArray(asRecord(resource.code)?.coding)
        .map((item) => readString(asRecord(item)?.code))
        .join(" ");
      if (HISTORY_CODES.has(loinc) || code.includes("anteced") || code.includes("history")) {
        patient.medicalHistory = patient.medicalHistory ? `${patient.medicalHistory}\n${value}` : value;
      } else {
        const encounter = patient.encounters[patient.encounters.length - 1];
        if (encounter) encounter.evolution = encounter.evolution ? `${encounter.evolution}\n${value}` : value;
        else warnings.push(`Observation ${resource.id ?? ""} sin Encounter; no se convierte a SOAP.`);
      }
    } else if (resource.resourceType === "Encounter") {
      const reason = asArray(resource.reasonCode).map(readCodeableText).filter(Boolean).join("\n");
      const diagnosis = asArray(resource.diagnosis)
        .map((item) => readString(asRecord(asRecord(item)?.condition)?.display))
        .filter(Boolean)
        .join("\n");
      const participant = asRecord(asArray(resource.participant)[0]);
      const professional = resolvePractitionerName(participant, byKey);
      const period = asRecord(resource.period);
      patient.encounters.push({
        localKey: resource.id || `enc-${patient.encounters.length + 1}`,
        date: readString(period?.start).slice(0, 10) || null,
        professionalName: professional || null,
        chiefComplaint: reason,
        diagnosis,
        evolution: "",
        indications: "",
      });
    } else if (resource.resourceType === "Condition") {
      const text = readCodeableText(resource.code);
      if (!text) continue;
      const last = patient.encounters[patient.encounters.length - 1];
      if (last) last.diagnosis = last.diagnosis ? `${last.diagnosis}\n${text}` : text;
      else patient.encounters.push({
        localKey: resource.id || `cond-${patient.encounters.length + 1}`,
        date: readString(resource.recordedDate).slice(0, 10) || null,
        professionalName: null,
        chiefComplaint: "Migración FHIR",
        diagnosis: text,
        evolution: "",
        indications: "",
      });
    } else if (resource.resourceType === "MedicationRequest") {
      const text = readCodeableText(resource.medicationCodeableConcept) || readCodeableText(resource.medication);
      const dose = readString(asRecord(asArray(resource.dosageInstruction)[0])?.text);
      const line = [text, dose].filter(Boolean).join(" · ");
      if (!line) continue;
      const last = patient.encounters[patient.encounters.length - 1];
      if (last) last.indications = last.indications ? `${last.indications}\n${line}` : line;
      else {
        patient.regularMedication = patient.regularMedication
          ? `${patient.regularMedication}; ${line}`
          : line;
      }
    } else if (resource.resourceType === "DiagnosticReport" || resource.resourceType === "DocumentReference") {
      warnings.push(
        `${resource.resourceType} ${resource.id ?? ""} no incluye archivo binario; se omite el adjunto.`
      );
    }
  }

  return { patients, warnings, issues, resourceCounts };
}
