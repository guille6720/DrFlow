import type { DbClient } from "@/core/repositories/types";
import { markAppointmentAttended } from "@/features/agenda/repositories/appointments.repository";
import {
  findClinicalRecordById,
  insertClinicalRecord,
  insertClinicalRecordAuditRow,
  updateClinicalRecordRow,
  type ClinicalRecordInsertRow,
  type ClinicalRecordUpdateRow,
} from "@/features/historias/repositories/clinical-records.repository";
import type { ServiceResult } from "@/core/services/types";
import { fromRepo, serviceErr, serviceOk } from "@/core/services/types";
import { parseConsultationModality } from "@/lib/constants/consultation-modality";
import { buildClinicalRecordAuditRow } from "@/core/security/audit-log";
import { clinicalRecordSchema, sanitizeText } from "@/core/validations/schemas";
import type { z } from "zod";

type ClinicalRecordInput = z.infer<typeof clinicalRecordSchema>;

function sanitizeClinicalRecordFields(data: ClinicalRecordInput) {
  return {
    ...data,
    chief_complaint: sanitizeText(data.chief_complaint ?? ""),
    diagnosis: sanitizeText(data.diagnosis ?? ""),
    evolution: sanitizeText(data.evolution ?? ""),
    indications: sanitizeText(data.indications ?? ""),
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

  const insertRow: ClinicalRecordInsertRow = {
    clinic_id: input.clinicId,
    patient_id: sanitized.patient_id,
    professional_id: sanitized.professional_id,
    appointment_id: sanitized.appointment_id ?? null,
    chief_complaint: sanitized.chief_complaint,
    diagnosis: sanitized.diagnosis,
    evolution: sanitized.evolution,
    indications: sanitized.indications,
    created_by: input.userId,
  };

  const created = await insertClinicalRecord(db, insertRow);
  if (!created.ok) return serviceErr(created.error);

  if (sanitized.appointment_id) {
    const modality = parseConsultationModality(input.consultationModalityRaw);
    const apptResult = await markAppointmentAttended(
      db,
      sanitized.appointment_id,
      input.clinicId,
      modality
    );
    if (!apptResult.ok) return serviceErr(apptResult.error);
  }

  const auditRow = buildClinicalRecordAuditRow({
    clinicalRecordId: String(created.data.id),
    clinicId: input.clinicId,
    patientId: sanitized.patient_id,
    action: "create",
    what: "Creó consulta clínica (SOAP)",
    changedBy: input.userId,
    newValues: created.data,
    ipAddress: input.auditContext.ip_address,
    userAgent: input.auditContext.user_agent,
  });

  const auditResult = await insertClinicalRecordAuditRow(db, auditRow);
  if (!auditResult.ok) return serviceErr(auditResult.error);

  return serviceOk(created.data as ClinicalRecordRow);
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
  const old = await findClinicalRecordById(db, input.recordId, input.clinicId);
  if (!old) return serviceErr("Consulta no encontrada");

  const sanitized = sanitizeClinicalRecordFields(input.parsed);
  const updateRow: ClinicalRecordUpdateRow = {
    patient_id: sanitized.patient_id,
    professional_id: sanitized.professional_id,
    appointment_id: sanitized.appointment_id ?? null,
    chief_complaint: sanitized.chief_complaint,
    diagnosis: sanitized.diagnosis,
    evolution: sanitized.evolution,
    indications: sanitized.indications,
    updated_by: input.userId,
    updated_at: new Date().toISOString(),
  };

  const updated = await updateClinicalRecordRow(db, input.recordId, input.clinicId, updateRow);
  if (!updated.ok) return fromRepo(updated);

  const auditRow = buildClinicalRecordAuditRow({
    clinicalRecordId: input.recordId,
    clinicId: input.clinicId,
    patientId: String(old.patient_id),
    action: "update",
    what: "Modificó consulta clínica (SOAP)",
    changedBy: input.userId,
    oldValues: old,
    newValues: updated.data,
    ipAddress: input.auditContext.ip_address,
    userAgent: input.auditContext.user_agent,
  });

  const auditResult = await insertClinicalRecordAuditRow(db, auditRow);
  if (!auditResult.ok) return serviceErr(auditResult.error);

  return serviceOk({ old, data: updated.data });
}
