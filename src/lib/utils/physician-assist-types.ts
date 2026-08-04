/** Inline physician assist — embedded in clinical workflows, never a standalone module. */

export type PhysicianAssistKind =
  | "soap"
  | "clinical_summary"
  | "differential"
  | "evolution_draft"
  | "physical_exam"
  | "therapeutic_plan"
  | "cie10_suggestion"
  | "prescription_draft"
  | "order_draft"
  | "dosage_hint"
  | "coverage_note"
  | "follow_up_reminder"
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
  insurancePlan?: string | null;
  /** Free text from order form — e.g. "control de diabetes". */
  orderIntentText?: string | null;
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
  evolution_draft: "Borrador de evolución",
  physical_exam: "Examen físico sugerido",
  therapeutic_plan: "Plan terapéutico",
  cie10_suggestion: "CIE-10 sugerido",
  prescription_draft: "Borrador de receta",
  order_draft: "Borrador de orden",
  dosage_hint: "Dosis de referencia",
  coverage_note: "Cobertura del paciente",
  follow_up_reminder: "Control sugerido",
  discharge_summary: "Resumen de alta",
  medical_certificate: "Certificado médico",
  interaction_alert: "Alerta de interacción",
};
