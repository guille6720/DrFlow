import type { z } from "zod";

import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import type { DbClient } from "@/core/repositories/types";
import type { ServiceResult } from "@/core/services/types";
import { serviceErr, serviceOk } from "@/core/services/types";
import { clinicalRecordSchema, sanitizeText } from "@/core/validations/schemas";

import { parseConsultationModality } from "@/lib/constants/consultation-modality";
import {
  parseDiagnosesJson,
  parseTreatmentsJson,
} from "@/features/historias/utils/clinical-structured-entries";

type ClinicalRecordInput = z.infer<typeof clinicalRecordSchema>;

function sanitizeClinicalRecordFields(data: ClinicalRecordInput) {
  return {
    ...data,
    chief_complaint: sanitizeText(data.chief_complaint ?? ""),
    diagnosis: sanitizeText(data.diagnosis ?? ""),
    evolution: sanitizeText(data.evolution ?? ""),
    indications: sanitizeText(data.indications ?? ""),
    diagnosis_cie10: sanitizeText(data.diagnosis_cie10 ?? "") || null,
  };
}

function parseStructuredPayloads(data: ClinicalRecordInput) {
  let diagnosesJson: unknown = [];
  let treatmentsJson: unknown = [];
  if (data.diagnoses_json?.trim()) {
    try {
      diagnosesJson = JSON.parse(data.diagnoses_json);
    } catch {
      diagnosesJson = [];
    }
  }
  if (data.treatments_json?.trim()) {
    try {
      treatmentsJson = JSON.parse(data.treatments_json);
    } catch {
      treatmentsJson = [];
    }
  }
  return {
    diagnoses: parseDiagnosesJson(diagnosesJson),
    treatments: parseTreatmentsJson(treatmentsJson),
  };
}

export type ClinicalRecordRow = Record<string, unknown> & { id: string };

export async function createClinicalRecordEntry(
  db: DbClient,
  input: {
    clinicId: string;
    userId: string;
    parsed: ClinicalRecordInput;
    consultationModalityRaw: unknown;
    auditContext: { ip_address: string | null; user_agent: string | null };
  }
): Promise<ServiceResult<ClinicalRecordRow>> {
  const sanitized = sanitizeClinicalRecordFields(input.parsed);
  const structured = parseStructuredPayloads(input.parsed);
  const modality = parseConsultationModality(input.consultationModalityRaw);
  const consultationAt = input.parsed.consultation_at?.trim() || null;

  const { data, error } = await db.rpc("create_clinical_record_atomic", {
    p_clinic_id: input.clinicId,
    p_patient_id: sanitized.patient_id,
    p_professional_id: sanitized.professional_id,
    p_appointment_id: sanitized.appointment_id ?? null,
    p_chief_complaint: sanitized.chief_complaint,
    p_diagnosis: sanitized.diagnosis,
    p_evolution: sanitized.evolution,
    p_indications: sanitized.indications,
    p_created_by: input.userId,
    p_consultation_modality: modality,
    p_consultation_at: consultationAt,
    p_audit_what: "Creó consulta clínica (SOAP)",
    p_audit_ip: input.auditContext.ip_address,
    p_audit_user_agent: input.auditContext.user_agent,
    p_diagnosis_cie10: sanitized.diagnosis_cie10,
    p_diagnoses_json: structured.diagnoses,
    p_treatments_json: structured.treatments,
  });

  if (error) return serviceErr(error.message);
  return serviceOk(data as ClinicalRecordRow);
}

export async function updateClinicalRecordEntry(
  db: DbClient,
  input: {
    recordId: string;
    clinicId: string;
    userId: string;
    parsed: ClinicalRecordInput;
    auditContext: { ip_address: string | null; user_agent: string | null };
  }
): Promise<ServiceResult<{ old: Record<string, unknown>; data: Record<string, unknown> }>> {
  const sanitized = sanitizeClinicalRecordFields(input.parsed);
  const structured = parseStructuredPayloads(input.parsed);
  const consultationAt = input.parsed.consultation_at?.trim() || null;

  const { data, error } = await db.rpc("update_clinical_record_atomic", {
    p_clinic_id: input.clinicId,
    p_record_id: input.recordId,
    p_patient_id: sanitized.patient_id,
    p_professional_id: sanitized.professional_id,
    p_appointment_id: sanitized.appointment_id ?? null,
    p_chief_complaint: sanitized.chief_complaint,
    p_diagnosis: sanitized.diagnosis,
    p_evolution: sanitized.evolution,
    p_indications: sanitized.indications,
    p_updated_by: input.userId,
    p_consultation_at: consultationAt,
    p_audit_what: "Modificó consulta clínica (SOAP)",
    p_audit_ip: input.auditContext.ip_address,
    p_audit_user_agent: input.auditContext.user_agent,
    p_diagnosis_cie10: sanitized.diagnosis_cie10,
    p_diagnoses_json: structured.diagnoses,
    p_treatments_json: structured.treatments,
  });

  if (error) {
    return serviceErr(resolvePostgresUserMessage(error, { fallback: error.message }));
  }

  const payload = data as { old: Record<string, unknown>; data: Record<string, unknown> };
  return serviceOk(payload);
}
