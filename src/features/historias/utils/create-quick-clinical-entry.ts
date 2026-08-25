import { persistClinicalRecordRequest } from "@/features/historias/utils/persist-clinical-record-request";
import {
  buildDiagnosisText,
  type ClinicalDiagnosisEntry,
  type ClinicalTreatmentEntry,
  mergeTreatmentsForPersist,
} from "@/features/historias/utils/clinical-structured-entries";
import { buildEhrPayloadFromRecords } from "@/features/pacientes/utils/patient-ehr-model";
import { buildConsultIndicationsText } from "@/features/recetas/utils/build-consult-indications-text";

import type { PrescriptionMedication } from "@/types/prescription";

export type QuickClinicalSaveContext = {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  professionalName: string;
  professionalSignature?: string;
  consultationAtIso?: string;
};

export type QuickClinicalSaveResult = {
  ok: true;
  recordId: string;
  createdAt: string;
  consultations: ReturnType<typeof buildEhrPayloadFromRecords>["consultations"];
  diagnosisRows: ReturnType<typeof buildEhrPayloadFromRecords>["diagnosisRows"];
  treatmentRows: ReturnType<typeof buildEhrPayloadFromRecords>["treatmentRows"];
} | { ok: false; error: string };

function baseFormData(ctx: QuickClinicalSaveContext): FormData {
  const formData = new FormData();
  formData.set("patient_id", ctx.patientId);
  formData.set("professional_id", ctx.professionalId);
  if (ctx.appointmentId) formData.set("appointment_id", ctx.appointmentId);
  if (ctx.professionalSignature) {
    formData.set("professional_signature", ctx.professionalSignature);
  }
  formData.set(
    "consultation_at",
    ctx.consultationAtIso ?? new Date().toISOString()
  );
  return formData;
}

function payloadFromResult(
  result: { id: string; created_at?: string },
  mapped: {
    chief_complaint: string;
    diagnosis: string;
    evolution: string;
    indications: string;
    diagnosis_cie10?: string | null;
    diagnoses_json?: unknown;
    treatments_json?: unknown;
  },
  ctx: QuickClinicalSaveContext
): QuickClinicalSaveResult {
  const createdAt =
    typeof result.created_at === "string" && result.created_at
      ? result.created_at
      : new Date().toISOString();
  const built = buildEhrPayloadFromRecords(
    [
      {
        id: result.id,
        created_at: createdAt,
        chief_complaint: mapped.chief_complaint,
        diagnosis: mapped.diagnosis,
        evolution: mapped.evolution,
        indications: mapped.indications,
        diagnosis_cie10: mapped.diagnosis_cie10 ?? null,
        diagnoses_json: mapped.diagnoses_json,
        treatments_json: mapped.treatments_json,
        professional_name: ctx.professionalName,
        professional_id: ctx.professionalId,
        professional_signature: ctx.professionalSignature ?? null,
      },
    ],
    { includeHceStructural: true }
  );

  return {
    ok: true,
    recordId: result.id,
    createdAt,
    consultations: built.consultations,
    diagnosisRows: built.diagnosisRows,
    treatmentRows: built.treatmentRows,
  };
}

async function submitQuick(
  formData: FormData,
  mapped: Parameters<typeof payloadFromResult>[1],
  ctx: QuickClinicalSaveContext
): Promise<QuickClinicalSaveResult> {
  const result = await persistClinicalRecordRequest({
    patient_id: String(formData.get("patient_id") ?? ctx.patientId),
    professional_id: String(formData.get("professional_id") ?? ctx.professionalId),
    appointment_id:
      typeof formData.get("appointment_id") === "string"
        ? String(formData.get("appointment_id"))
        : ctx.appointmentId ?? null,
    chief_complaint: String(formData.get("chief_complaint") ?? ""),
    diagnosis: String(formData.get("diagnosis") ?? ""),
    evolution: String(formData.get("evolution") ?? ""),
    indications: String(formData.get("indications") ?? ""),
    professional_signature: String(formData.get("professional_signature") ?? ""),
    consultation_at: String(formData.get("consultation_at") ?? "") || null,
    diagnosis_cie10: String(formData.get("diagnosis_cie10") ?? "") || null,
    diagnoses_json: String(formData.get("diagnoses_json") ?? "") || null,
    treatments_json: String(formData.get("treatments_json") ?? "") || null,
  });
  if ("error" in result) {
    return { ok: false, error: result.error ?? "No se pudo guardar" };
  }
  return payloadFromResult(
    { id: result.data.id, created_at: ctx.consultationAtIso },
    mapped,
    ctx
  );
}

export async function saveQuickDiagnosis(
  ctx: QuickClinicalSaveContext,
  diagnosis: ClinicalDiagnosisEntry,
  notes?: string
): Promise<QuickClinicalSaveResult> {
  const diagnoses = [diagnosis];
  const diagnosisText = buildDiagnosisText(diagnoses);
  const evolution = notes?.trim() || diagnosisText;
  const formData = baseFormData(ctx);
  formData.set("chief_complaint", "Diagnóstico");
  formData.set("diagnosis", diagnosisText);
  formData.set("diagnosis_cie10", diagnosis.cie10_code?.trim() ?? "");
  formData.set("diagnoses_json", JSON.stringify(diagnoses));
  formData.set("treatments_json", "[]");
  formData.set("evolution", evolution);
  formData.set("indications", "");

  return submitQuick(
    formData,
    {
      chief_complaint: "Diagnóstico",
      diagnosis: diagnosisText,
      evolution,
      indications: "",
      diagnosis_cie10: diagnosis.cie10_code ?? null,
      diagnoses_json: diagnoses,
      treatments_json: [],
    },
    ctx
  );
}

export async function saveQuickTreatment(
  ctx: QuickClinicalSaveContext,
  treatment: ClinicalTreatmentEntry,
  medications: PrescriptionMedication[] = []
): Promise<QuickClinicalSaveResult> {
  const clinicalTreatments = [treatment];
  const merged = mergeTreatmentsForPersist(clinicalTreatments, medications);
  const indications = buildConsultIndicationsText(medications, "", clinicalTreatments);
  const evolution = treatment.product;
  const formData = baseFormData(ctx);
  formData.set("chief_complaint", "Tratamiento");
  formData.set("diagnosis", "");
  formData.set("diagnoses_json", "[]");
  formData.set("treatments_json", JSON.stringify(merged));
  formData.set("evolution", evolution);
  formData.set("indications", indications);

  return submitQuick(
    formData,
    {
      chief_complaint: "Tratamiento",
      diagnosis: "",
      evolution,
      indications,
      diagnoses_json: [],
      treatments_json: merged,
    },
    ctx
  );
}

export async function saveQuickVitals(
  ctx: QuickClinicalSaveContext,
  vitalsText: string
): Promise<QuickClinicalSaveResult> {
  const clean = vitalsText.trim();
  if (!clean) return { ok: false, error: "Ingresá al menos un signo vital" };
  const evolution = `Signos vitales: ${clean}`;
  const formData = baseFormData(ctx);
  formData.set("chief_complaint", "Signos vitales");
  formData.set("diagnosis", "");
  formData.set("diagnoses_json", "[]");
  formData.set("treatments_json", "[]");
  formData.set("evolution", evolution);
  formData.set("indications", "");

  return submitQuick(
    formData,
    {
      chief_complaint: "Signos vitales",
      diagnosis: "",
      evolution,
      indications: "",
      diagnoses_json: [],
      treatments_json: [],
    },
    ctx
  );
}

export async function saveFullConsultation(
  ctx: QuickClinicalSaveContext,
  input: {
    chiefComplaint: string;
    evolution: string;
    physicalExam?: string;
    indications: string;
    observations?: string;
    plan?: string;
    diagnoses: ClinicalDiagnosisEntry[];
    clinicalTreatments: ClinicalTreatmentEntry[];
    medications: PrescriptionMedication[];
    vitals?: string;
  }
): Promise<QuickClinicalSaveResult> {
  const diagnosisText = buildDiagnosisText(input.diagnoses);
  const merged = mergeTreatmentsForPersist(input.clinicalTreatments, input.medications);
  const indications = buildConsultIndicationsText(
    input.medications,
    [input.indications, input.plan, input.observations].filter(Boolean).join("\n"),
    input.clinicalTreatments
  );
  const evolutionParts = [
    input.evolution.trim(),
    input.physicalExam?.trim() ? `Examen físico:\n${input.physicalExam.trim()}` : "",
    input.vitals?.trim() ? `Signos vitales: ${input.vitals.trim()}` : "",
  ].filter(Boolean);
  const evolution = evolutionParts.join("\n\n");
  const chief = input.chiefComplaint.trim() || "Consulta";
  const primaryCie10 =
    input.diagnoses.find((d) => d.cie10_code?.trim())?.cie10_code ?? "";

  const formData = baseFormData(ctx);
  formData.set("chief_complaint", chief);
  formData.set("diagnosis", diagnosisText);
  formData.set("diagnosis_cie10", primaryCie10);
  formData.set("diagnoses_json", JSON.stringify(input.diagnoses));
  formData.set("treatments_json", JSON.stringify(merged));
  formData.set("evolution", evolution);
  formData.set("indications", indications);

  return submitQuick(
    formData,
    {
      chief_complaint: chief,
      diagnosis: diagnosisText,
      evolution,
      indications,
      diagnosis_cie10: primaryCie10 || null,
      diagnoses_json: input.diagnoses,
      treatments_json: merged,
    },
    ctx
  );
}
