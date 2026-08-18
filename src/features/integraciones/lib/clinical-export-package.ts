import type { ClinicalExportSection } from "@/features/integraciones/lib/clinical-export-sections";

export type ClinicalExportPatient = {
  document_number: string;
  last_name: string;
  first_name: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  insurance_provider: string | null;
  insurance_plan: string | null;
  insurance_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

export type ClinicalExportConsultation = {
  local_key: string;
  date: string;
  professional_name: string;
  chief_complaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
};

export type ClinicalExportDiagnosis = {
  date: string;
  name: string;
  chronic: boolean;
  cie10: string | null;
};

export type ClinicalExportMedication = {
  date: string;
  product: string;
  dose: string;
  frequency: string;
  notes: string;
  status: string;
};

export type ClinicalExportPrescription = {
  prescription_number: string | null;
  issued_at: string | null;
  status: string;
  diagnosis_text: string | null;
  professional_name: string | null;
  medications: Array<{
    generic_name: string;
    brand_name?: string;
    presentation?: string;
    quantity: number;
    posology: string;
  }>;
};

export type ClinicalExportOrder = {
  issued_at: string;
  order_type: string | null;
  order_text: string;
  notes: string | null;
  status: string;
  professional_name: string | null;
};

export type ClinicalExportAttachment = {
  file_name: string;
  category: string | null;
  created_at: string;
  document_date: string | null;
  source: string | null;
};

export type ClinicalExportSnapshot = {
  exported_at: string;
  patient: ClinicalExportPatient;
  medical_history: string | null;
  allergies: string | null;
  regular_medication: string | null;
  consultations: ClinicalExportConsultation[];
  diagnoses: ClinicalExportDiagnosis[];
  medications: ClinicalExportMedication[];
  prescriptions: ClinicalExportPrescription[];
  orders: ClinicalExportOrder[];
  attachments: ClinicalExportAttachment[];
  warnings: string[];
};

export function buildClinicalExportDocument(
  snapshot: ClinicalExportSnapshot,
  sections: ClinicalExportSection[]
): Record<string, unknown> {
  const include = new Set(sections);
  const body: Record<string, unknown> = {
    schema: "drflow.clinical-record.v1",
    exported_at: snapshot.exported_at,
  };

  if (include.has("demographics")) body.patient = snapshot.patient;
  if (include.has("medical_history")) body.medical_history = snapshot.medical_history;
  if (include.has("allergies")) body.allergies = snapshot.allergies;
  if (include.has("consultations")) body.consultations = snapshot.consultations;
  if (include.has("diagnoses")) body.diagnoses = snapshot.diagnoses;
  if (include.has("medications")) {
    body.regular_medication = snapshot.regular_medication;
    body.medications = snapshot.medications;
  }
  if (include.has("prescriptions")) body.prescriptions = snapshot.prescriptions;
  if (include.has("orders")) body.orders = snapshot.orders;
  if (include.has("studies") || include.has("attachments")) {
    const studies = snapshot.attachments.filter((item) => item.category === "estudio");
    const rest = snapshot.attachments.filter((item) => item.category !== "estudio");
    if (include.has("studies")) body.studies = studies;
    if (include.has("attachments")) body.attachments = rest;
  }
  if (snapshot.warnings.length > 0) body.warnings = snapshot.warnings;

  return body;
}

export function countExportedRecords(
  document: Record<string, unknown>
): number {
  let count = 0;
  for (const key of [
    "consultations",
    "diagnoses",
    "medications",
    "prescriptions",
    "orders",
    "studies",
    "attachments",
  ]) {
    const value = document[key];
    if (Array.isArray(value)) count += value.length;
  }
  return count;
}
