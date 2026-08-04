/** Inline physician assist — embedded in clinical workflows, never a standalone module. */

export type PhysicianAssistKind =
  | "soap"
  | "clinical_summary"
  | "differential"
  | "prescription_draft"
  | "order_draft"
  | "discharge_summary"
  | "medical_certificate"
  | "interaction_alert";

export type PhysicianAssistContext = {
  patientName?: string;
  allergies?: string | null;
  regularMedication?: string | null;
  medicalHistory?: string | null;
  evolutionText?: string;
  diagnosis?: string | null;
  chiefComplaint?: string | null;
  activeProblems?: string[];
  lastEvolution?: string | null;
  lastDiagnosis?: string | null;
  ageLabel?: string;
  sex?: string;
  insurance?: string;
  proposedMedications?: string[];
};

export type PhysicianAssistItem = {
  id: string;
  kind: PhysicianAssistKind;
  title: string;
  body: string;
};

export const PHYSICIAN_ASSIST_DISCLAIMER =
  "Sugerencia asistida — requiere confirmación del médico. No reemplaza criterio clínico ni responsabilidad profesional.";

export const PHYSICIAN_ASSIST_KIND_LABELS: Record<PhysicianAssistKind, string> = {
  soap: "Borrador SOAP",
  clinical_summary: "Resumen clínico",
  differential: "Diagnóstico diferencial",
  prescription_draft: "Borrador de receta",
  order_draft: "Borrador de orden",
  discharge_summary: "Resumen de alta",
  medical_certificate: "Certificado médico",
  interaction_alert: "Alerta de interacción",
};
