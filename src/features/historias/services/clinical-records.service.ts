import type { z } from "zod";

import {
  insertClinicalRecordPatchAudit,
} from "@/core/compliance/clinical-record-integrity";
import {
  isMissingRpcInSchemaCache,
  resolvePostgresUserMessage,
} from "@/core/errors/postgres-error";
import type { DbClient } from "@/core/repositories/types";
import type { ServiceResult } from "@/core/services/types";
import { serviceErr, serviceOk } from "@/core/services/types";
import { CLINICAL_RECORD_INSERT_RETURN_COLUMNS } from "@/core/supabase/select-columns";
import { clinicalRecordSchema, sanitizeText } from "@/core/validations/schemas";

import {
  parseDiagnosesJson,
  parseTreatmentsJson,
} from "@/features/historias/utils/clinical-structured-entries";

import { parseConsultationModality } from "@/lib/constants/consultation-modality";

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

function parseStructuredPayloads(data: ClinicalRecordInput): {
  diagnoses: ReturnType<typeof parseDiagnosesJson> | null;
  treatments: ReturnType<typeof parseTreatmentsJson> | null;
} {
  // null = caller did not send JSON → do not wipe/re-sync children (migration 152).
  let diagnoses: ReturnType<typeof parseDiagnosesJson> | null = null;
  let treatments: ReturnType<typeof parseTreatmentsJson> | null = null;

  if (data.diagnoses_json != null && data.diagnoses_json.trim() !== "") {
    try {
      diagnoses = parseDiagnosesJson(JSON.parse(data.diagnoses_json));
    } catch {
      diagnoses = [];
    }
  }
  if (data.treatments_json != null && data.treatments_json.trim() !== "") {
    try {
      treatments = parseTreatmentsJson(JSON.parse(data.treatments_json));
    } catch {
      treatments = [];
    }
  }
  return { diagnoses, treatments };
}

export type ClinicalRecordRow = Record<string, unknown> & { id: string };

type RpcArgs = Record<string, unknown>;

function withoutStructuredPayload(args: RpcArgs): RpcArgs {
  const next = { ...args };
  delete next.p_diagnosis_cie10;
  delete next.p_diagnoses_json;
  delete next.p_treatments_json;
  return next;
}

function withoutConsultationAt(args: RpcArgs): RpcArgs {
  const next = withoutStructuredPayload(args);
  delete next.p_consultation_at;
  return next;
}

function isRpcOverloadAmbiguity(error: {
  message?: string;
  details?: string;
  hint?: string;
}): boolean {
  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return message.includes("could not choose the best candidate function");
}

async function rpcWithLegacyFallback(
  db: DbClient,
  fn: "create_clinical_record_atomic" | "update_clinical_record_atomic",
  args: RpcArgs
) {
  const withChangeReason =
    fn === "update_clinical_record_atomic"
      ? { ...args, p_change_reason: args.p_change_reason ?? null }
      : args;
  const attempts = [withChangeReason, args, withoutStructuredPayload(args), withoutConsultationAt(args)];
  let lastError: { message?: string; code?: string; details?: string; hint?: string } | null =
    null;

  for (const payload of attempts) {
    const { data, error } = await db.rpc(fn, payload as never);
    if (!error) return { data, error: null };
    lastError = error;
    // Keep retrying when PostgREST cannot resolve the overload, or when the
    // newer structured tables/columns are missing in an older DB.
    const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
    const schemaDrift =
      isMissingRpcInSchemaCache(error) ||
      isRpcOverloadAmbiguity(error) ||
      message.includes("diagnoses_json") ||
      message.includes("treatments_json") ||
      message.includes("diagnosis_cie10") ||
      message.includes("clinical_record_diagnoses") ||
      message.includes("clinical_record_treatments") ||
      message.includes("sync_clinical_record_children");
    if (!schemaDrift) break;
  }

  return { data: null, error: lastError };
}

async function tryPersistStructuredColumns(
  db: DbClient,
  recordId: string,
  clinicId: string,
  userId: string,
  auditContext: { ip_address: string | null; user_agent: string | null },
  payload: {
    diagnosis_cie10: string | null;
    diagnoses: unknown[] | null;
    treatments: unknown[] | null;
  }
) {
  if (payload.diagnoses == null && payload.treatments == null) return;

  const { data: before } = await db
    .from("clinical_records")
    .select(
      "id, patient_id, diagnosis_cie10, diagnoses_json, treatments_json, record_version"
    )
    .eq("id", recordId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!before) return;

  const nextDiagnoses = payload.diagnoses ?? before.diagnoses_json ?? [];
  const nextTreatments = payload.treatments ?? before.treatments_json ?? [];

  const { error } = await db
    .from("clinical_records")
    .update({
      diagnosis_cie10: payload.diagnosis_cie10,
      diagnoses_json: nextDiagnoses,
      treatments_json: nextTreatments,
      record_version: (before.record_version ?? 1) + 1,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordId)
    .eq("clinic_id", clinicId);

  if (error) return;

  const beforeSnap = {
    diagnosis_cie10: before.diagnosis_cie10,
    diagnoses_json: before.diagnoses_json,
    treatments_json: before.treatments_json,
    record_version: before.record_version ?? 1,
  };
  const afterSnap = {
    diagnosis_cie10: payload.diagnosis_cie10,
    diagnoses_json: nextDiagnoses,
    treatments_json: nextTreatments,
    record_version: (before.record_version ?? 1) + 1,
  };

  if (JSON.stringify(beforeSnap) === JSON.stringify(afterSnap)) return;

  await insertClinicalRecordPatchAudit(db, {
    clinicalRecordId: recordId,
    clinicId,
    patientId: before.patient_id,
    changedBy: userId,
    what: "Actualizó diagnósticos/tratamientos estructurados (legacy RPC)",
    oldValues: beforeSnap,
    newValues: afterSnap,
    ipAddress: auditContext.ip_address,
    userAgent: auditContext.user_agent,
  });
}

async function insertClinicalRecordDirect(
  db: DbClient,
  input: {
    clinicId: string;
    userId: string;
    sanitized: ReturnType<typeof sanitizeClinicalRecordFields>;
    modality: string | null;
    consultationAt: string | null;
  }
): Promise<ServiceResult<ClinicalRecordRow>> {
  const baseRow = {
    clinic_id: input.clinicId,
    patient_id: input.sanitized.patient_id,
    professional_id: input.sanitized.professional_id,
    appointment_id: input.sanitized.appointment_id ?? null,
    chief_complaint: input.sanitized.chief_complaint,
    diagnosis: input.sanitized.diagnosis,
    evolution: input.sanitized.evolution,
    indications: input.sanitized.indications,
    created_by: input.userId,
    created_at: input.consultationAt ?? new Date().toISOString(),
  };

  const withStructured = {
    ...baseRow,
    diagnosis_cie10: input.sanitized.diagnosis_cie10,
  };

  let result = await db
    .from("clinical_records")
    .insert(withStructured)
    .select(CLINICAL_RECORD_INSERT_RETURN_COLUMNS)
    .single();
  if (result.error) {
    const message = (result.error.message ?? "").toLowerCase();
    if (message.includes("diagnosis_cie10") || message.includes("diagnoses_json")) {
      result = await db
        .from("clinical_records")
        .insert(baseRow)
        .select(CLINICAL_RECORD_INSERT_RETURN_COLUMNS)
        .single();
    }
  }

  if (result.error) {
    return serviceErr(
      resolvePostgresUserMessage(result.error, {
        fallback: "No se pudo guardar la consulta. Intentá de nuevo.",
      })
    );
  }

  const row = result.data as ClinicalRecordRow;
  if (input.sanitized.appointment_id) {
    await db
      .from("appointments")
      .update({
        status: "attended",
        ...(input.modality ? { consultation_modality: input.modality } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.sanitized.appointment_id)
      .eq("clinic_id", input.clinicId);
  }

  return serviceOk(row);
}

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

  const { data, error } = await rpcWithLegacyFallback(db, "create_clinical_record_atomic", {
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
    p_diagnoses_json: structured.diagnoses ?? [],
    p_treatments_json: structured.treatments ?? [],
  });

  if (error) {
    const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
    const canFallback =
      isMissingRpcInSchemaCache(error) ||
      message.includes("sync_clinical_record_children") ||
      message.includes("clinical_record_diagnoses") ||
      message.includes("clinical_record_treatments") ||
      message.includes("diagnoses_json") ||
      message.includes("treatments_json");

    if (canFallback) {
      const fallback = await insertClinicalRecordDirect(db, {
        clinicId: input.clinicId,
        userId: input.userId,
        sanitized,
        modality,
        consultationAt,
      });
      if (fallback.ok && fallback.data?.id) {
        await tryPersistStructuredColumns(
          db,
          fallback.data.id,
          input.clinicId,
          input.userId,
          input.auditContext,
          {
            diagnosis_cie10: sanitized.diagnosis_cie10,
            diagnoses: structured.diagnoses ?? [],
            treatments: structured.treatments ?? [],
          }
        );
      }
      return fallback;
    }

    return serviceErr(
      resolvePostgresUserMessage(error, {
        fallback: "No se pudo guardar la consulta. Intentá de nuevo.",
      })
    );
  }

  const row = data as ClinicalRecordRow;
  if (row?.id) {
    await tryPersistStructuredColumns(db, row.id, input.clinicId, input.userId, input.auditContext, {
      diagnosis_cie10: sanitized.diagnosis_cie10,
      diagnoses: structured.diagnoses ?? [],
      treatments: structured.treatments ?? [],
    });
  }

  return serviceOk(row);
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

  const rpcArgs: RpcArgs = {
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
  };
  // Only send structured payloads when the caller provided them. Omitting keeps
  // PostgREST from defaulting missing params to [] on older DB overloads; on
  // migration 152+, NULL means "leave children alone".
  if (structured.diagnoses != null) {
    rpcArgs.p_diagnoses_json = structured.diagnoses;
  }
  if (structured.treatments != null) {
    rpcArgs.p_treatments_json = structured.treatments;
  }

  const { data, error } = await rpcWithLegacyFallback(db, "update_clinical_record_atomic", rpcArgs);

  if (error) {
    return serviceErr(resolvePostgresUserMessage(error, { fallback: error.message }));
  }

  await tryPersistStructuredColumns(db, input.recordId, input.clinicId, input.userId, input.auditContext, {
    diagnosis_cie10: sanitized.diagnosis_cie10,
    diagnoses: structured.diagnoses,
    treatments: structured.treatments,
  });

  // Guarantee SOAP text + consultation date persist even if an older RPC overload
  // ignored some parameters (PostgREST overload / schema drift).
  const soapPatch: Record<string, unknown> = {
    chief_complaint: sanitized.chief_complaint,
    diagnosis: sanitized.diagnosis,
    evolution: sanitized.evolution,
    indications: sanitized.indications,
    updated_by: input.userId,
    updated_at: new Date().toISOString(),
  };
  if (consultationAt) {
    soapPatch.created_at = consultationAt;
  }
  const { error: soapError } = await db
    .from("clinical_records")
    .update(soapPatch)
    .eq("id", input.recordId)
    .eq("clinic_id", input.clinicId);
  if (soapError) {
    return serviceErr(
      resolvePostgresUserMessage(soapError, {
        fallback: "No se pudo guardar el contenido de la consulta.",
      })
    );
  }

  if (consultationAt) {
    const stamp = { created_at: consultationAt, updated_at: new Date().toISOString() };
    await Promise.all([
      db
        .from("clinical_record_diagnoses")
        .update(stamp)
        .eq("clinical_record_id", input.recordId)
        .eq("clinic_id", input.clinicId),
      db
        .from("clinical_record_treatments")
        .update(stamp)
        .eq("clinical_record_id", input.recordId)
        .eq("clinic_id", input.clinicId),
      db
        .from("prescription_drafts")
        .update(stamp)
        .eq("clinical_record_id", input.recordId)
        .eq("clinic_id", input.clinicId),
    ]);
    await db
      .from("prescription_drafts")
      .update({ issued_at: consultationAt, updated_at: stamp.updated_at })
      .eq("clinical_record_id", input.recordId)
      .eq("clinic_id", input.clinicId)
      .not("issued_at", "is", null);
  }

  const payload = data as { old: Record<string, unknown>; data: Record<string, unknown> };
  return serviceOk({
    old: payload?.old ?? {},
    data: {
      ...(payload?.data ?? {}),
      ...soapPatch,
      id: input.recordId,
      patient_id: sanitized.patient_id,
    },
  });
}
