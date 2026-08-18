import {
  FHIR_DNI_SYSTEM,
  FHIR_ICD10_SYSTEM,
  FHIR_INSURANCE_SYSTEM_PREFIX,
  FHIR_LOINC_SYSTEM,
  FHIR_R4_VERSION,
  type FhirBundle,
  fhirReference,
  type FhirResource,
  fhirTextConcept,
  localResourceId,
} from "@/core/services/interoperability/fhir/types";

import type { ClinicalExportSnapshot } from "@/features/integraciones/lib/clinical-export-package";
import type { ClinicalExportSection } from "@/features/integraciones/lib/clinical-export-sections";

function practitionerId(name: string, used: Map<string, string>): string {
  const key = name.trim().toLowerCase() || "profesional";
  const existing = used.get(key);
  if (existing) return existing;
  const id = localResourceId("Practitioner", used.size + 1);
  used.set(key, id);
  return id;
}

function patientResource(snapshot: ClinicalExportSnapshot): FhirResource {
  const patient = snapshot.patient;
  const identifiers: Array<Record<string, unknown>> = [
    {
      use: "official",
      type: fhirTextConcept("DNI", [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "NI" }]),
      system: FHIR_DNI_SYSTEM,
      value: patient.document_number,
    },
  ];
  if (patient.insurance_number) {
    identifiers.push({
      type: fhirTextConcept("Nº de afiliado"),
      system: `${FHIR_INSURANCE_SYSTEM_PREFIX}${encodeURIComponent(patient.insurance_provider || "cobertura")}`,
      value: patient.insurance_number,
    });
  }

  const telecom: Array<Record<string, string>> = [];
  if (patient.phone) telecom.push({ system: "phone", value: patient.phone });
  if (patient.email) telecom.push({ system: "email", value: patient.email });

  const contact = patient.emergency_contact_name
    ? [
        {
          relationship: [fhirTextConcept("Contacto de emergencia")],
          name: { text: patient.emergency_contact_name },
          telecom: patient.emergency_contact_phone
            ? [{ system: "phone", value: patient.emergency_contact_phone }]
            : undefined,
        },
      ]
    : undefined;

  return {
    resourceType: "Patient",
    id: "patient-1",
    identifier: identifiers,
    name: [{ use: "official", family: patient.last_name, given: [patient.first_name] }],
    birthDate: patient.birth_date ?? undefined,
    telecom: telecom.length ? telecom : undefined,
    address: patient.address ? [{ text: patient.address }] : undefined,
    contact,
  };
}

export function mapClinicalSnapshotToFhirBundle(
  snapshot: ClinicalExportSnapshot,
  sections: ClinicalExportSection[]
): FhirBundle {
  const include = new Set(sections);
  const resources: FhirResource[] = [];
  const practitioners = new Map<string, string>();

  if (include.has("demographics")) resources.push(patientResource(snapshot));

  const subject = fhirReference("Patient", "patient-1", `${snapshot.patient.last_name}, ${snapshot.patient.first_name}`);

  if (include.has("allergies") && snapshot.allergies?.trim()) {
    resources.push({
      resourceType: "AllergyIntolerance",
      id: localResourceId("AllergyIntolerance", 1),
      clinicalStatus: fhirTextConcept("active", [
        { system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" },
      ]),
      code: fhirTextConcept(snapshot.allergies),
      patient: subject,
    });
  }

  if (include.has("medical_history") && snapshot.medical_history?.trim()) {
    resources.push({
      resourceType: "Observation",
      id: localResourceId("Observation", 1),
      status: "final",
      code: fhirTextConcept("Antecedentes", [
        { system: FHIR_LOINC_SYSTEM, code: "11348-0", display: "History of Past Illness" },
      ]),
      subject,
      valueString: snapshot.medical_history,
    });
  }

  if (include.has("consultations")) {
    snapshot.consultations.forEach((row, index) => {
      const pracId = practitionerId(row.professional_name, practitioners);
      resources.push({
        resourceType: "Encounter",
        id: row.local_key || localResourceId("Encounter", index + 1),
        status: "finished",
        class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
        subject,
        participant: [
          {
            individual: fhirReference("Practitioner", pracId, row.professional_name),
          },
        ],
        period: { start: row.date },
        reasonCode: row.chief_complaint ? [fhirTextConcept(row.chief_complaint)] : undefined,
        diagnosis: row.diagnosis ? [{ condition: { display: row.diagnosis } }] : undefined,
      });
    });
  }

  if (include.has("diagnoses")) {
    snapshot.diagnoses.forEach((row, index) => {
      const coding = row.cie10
        ? [{ system: FHIR_ICD10_SYSTEM, code: row.cie10, display: row.name }]
        : undefined;
      resources.push({
        resourceType: "Condition",
        id: localResourceId("Condition", index + 1),
        clinicalStatus: fhirTextConcept(row.chronic ? "active" : "resolved", [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: row.chronic ? "active" : "resolved",
          },
        ]),
        code: fhirTextConcept(row.name, coding),
        subject,
        recordedDate: row.date,
      });
    });
  }

  if (include.has("medications")) {
    snapshot.medications.forEach((row, index) => {
      resources.push({
        resourceType: "MedicationRequest",
        id: localResourceId("MedicationRequest", index + 1),
        status: "active",
        intent: "plan",
        medicationCodeableConcept: fhirTextConcept(row.product),
        subject,
        authoredOn: row.date,
        dosageInstruction: row.dose || row.frequency
          ? [{ text: [row.dose, row.frequency, row.notes].filter(Boolean).join(" · ") }]
          : undefined,
      });
    });
  }

  if (include.has("prescriptions")) {
    const offset = include.has("medications") ? snapshot.medications.length : 0;
    snapshot.prescriptions.forEach((row, index) => {
      const label =
        row.medications.map((item) => item.generic_name).filter(Boolean).join(", ") ||
        row.diagnosis_text ||
        "Receta";
      resources.push({
        resourceType: "MedicationRequest",
        id: localResourceId("MedicationRequest", offset + index + 1),
        status: row.status === "void" ? "cancelled" : "completed",
        intent: "order",
        medicationCodeableConcept: fhirTextConcept(label),
        subject,
        authoredOn: row.issued_at ?? undefined,
        identifier: row.prescription_number
          ? [{ value: row.prescription_number }]
          : undefined,
        note: row.diagnosis_text ? [{ text: row.diagnosis_text }] : undefined,
        requester: row.professional_name
          ? fhirReference("Practitioner", practitionerId(row.professional_name, practitioners), row.professional_name)
          : undefined,
      });
    });
  }

  if (include.has("orders")) {
    snapshot.orders.forEach((row, index) => {
      resources.push({
        resourceType: "DiagnosticReport",
        id: localResourceId("DiagnosticReport", index + 1),
        status: "final",
        code: fhirTextConcept(row.order_type || "Orden médica"),
        subject,
        effectiveDateTime: row.issued_at,
        conclusion: [row.order_text, row.notes].filter(Boolean).join("\n") || undefined,
      });
    });
  }

  const reportsStart = include.has("orders") ? snapshot.orders.length : 0;
  if (include.has("studies") || include.has("attachments")) {
    snapshot.attachments.forEach((row, index) => {
      if (row.category === "estudio" && include.has("studies")) {
        resources.push({
          resourceType: "DiagnosticReport",
          id: localResourceId("DiagnosticReport", reportsStart + index + 1),
          status: "final",
          code: fhirTextConcept("Estudio"),
          subject,
          effectiveDateTime: row.document_date ?? row.created_at,
          presentedForm: [{ title: row.file_name, contentType: "application/octet-stream" }],
        });
      } else if (row.category !== "estudio" && include.has("attachments")) {
        resources.push({
          resourceType: "DocumentReference",
          id: localResourceId("DocumentReference", index + 1),
          status: "current",
          type: fhirTextConcept(row.category || "Documento"),
          subject,
          date: row.document_date ?? row.created_at,
          content: [{ attachment: { title: row.file_name } }],
        });
      }
    });
  }

  for (const [name, id] of practitioners) {
    resources.push({
      resourceType: "Practitioner",
      id,
      name: [{ text: name }],
    });
  }

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: snapshot.exported_at,
    total: resources.length,
    meta: { profile: [`https://hl7.org/fhir/${FHIR_R4_VERSION}/Bundle`] },
    entry: resources.map((resource) => ({
      fullUrl: resource.id ? `${resource.resourceType}/${resource.id}` : undefined,
      resource,
    })),
  };
}
