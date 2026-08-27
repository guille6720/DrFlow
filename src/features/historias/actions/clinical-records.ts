"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.actions";
import {
  clinicalLifecycleLabel,
  type ClinicalLifecycleStatus,
  isArchivableLifecycle,
} from "@/core/compliance/clinical-deletion-protection";
import {
  isMissingRpcInSchemaCache,
  resolvePostgresUserMessage,
} from "@/core/errors/postgres-error";
import {
  type AuditRequestContext,
  getAuditRequestContext,
} from "@/core/security/audit-context";
import { verifyClinicalRecordForeignKeys } from "@/core/security/ownership-guard";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue, parseEntityId } from "@/core/validations/params";
import { clinicalRecordSchema } from "@/core/validations/schemas";

import {
  createClinicalRecordEntry,
  updateClinicalRecordEntry,
} from "@/features/historias/services/clinical-records.service";

type ClinicWriteAccess = {
  clinicId: string;
  userId: string;
};

async function gateClinicalRecordWrite(): Promise<
  | { ok: true; access: ClinicWriteAccess; ctx: AuditRequestContext }
  | { ok: false; error: string }
> {
  const [access, ctx] = await Promise.all([
    requireClinicPermission("editClinicalRecords"),
    getAuditRequestContext(),
  ]);
  if (!access.ok) return { error: access.error, ok: false };
  return {
    ok: true,
    access: { clinicId: access.clinicId, userId: access.userId },
    ctx,
  };
}

function parseClinicalRecordForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = clinicalRecordSchema.safeParse({
    ...raw,
    appointment_id: raw.appointment_id || null,
  });
  return { raw, parsed };
}

export async function createClinicalRecord(formData: FormData) {
  const [gate, supabase] = await Promise.all([gateClinicalRecordWrite(), createClient()]);
  if (!gate.ok) return { error: gate.error };
  const { clinicId, userId } = gate.access;

  const { raw, parsed } = parseClinicalRecordForm(formData);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };
  const ownership = await verifyClinicalRecordForeignKeys(supabase, clinicId, {
    patientId: parsed.data.patient_id,
    professionalId: parsed.data.professional_id,
    appointmentId: parsed.data.appointment_id,
  });
  if (!ownership.ok) return { error: ownership.error };

  const result = await createClinicalRecordEntry(supabase, {
    clinicId,
    userId,
    parsed: parsed.data,
    consultationModalityRaw: raw.consultation_modality,
    auditContext: gate.ctx,
  });

  if (!result.ok) return { error: result.error };

  if (parsed.data.appointment_id) {
    revalidatePath("/turnos/agenda");
  }

  void logAudit({
    clinicId,
    module: "clinical",
    what: "Creó consulta clínica (SOAP)",
    entityType: "clinical_record",
    entityId: String(result.data.id),
    patientId: parsed.data.patient_id,
    action: "create",
    newValues: result.data,
  });

  revalidatePath("/consultas");
  revalidatePath(`/pacientes/${parsed.data.patient_id}`, "page");
  return { data: result.data };
}

export async function updateClinicalRecordConsultationAt(
  recordId: string,
  consultationAtIso: string
) {
  try {
    const [gate, supabase] = await Promise.all([gateClinicalRecordWrite(), createClient()]);
    if (!gate.ok) return { error: gate.error };
    const { clinicId, userId } = gate.access;

    const idParsed = parseEntityId(recordId, "Consulta");
    if (!idParsed.ok) return { error: idParsed.error };

    const parsedDate = new Date(consultationAtIso);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "Fecha de consulta inválida." };
    }
    const consultationAt = parsedDate.toISOString();

    // Prefer lean RPC (migration 149). Race a timeout so PostgREST schema-cache
    // stalls cannot leave the UI spinning forever.
    const rpcCall = supabase.rpc("update_clinical_record_consultation_at" as never, {
      p_clinic_id: clinicId,
      p_record_id: idParsed.data,
      p_consultation_at: consultationAt,
      p_updated_by: userId,
      p_audit_ip: gate.ctx.ip_address,
      p_audit_user_agent: gate.ctx.user_agent,
    } as never);

    const rpcResult = (await Promise.race([
      rpcCall,
      new Promise<{ data: null; error: { message: string; code: string } }>((resolve) =>
        setTimeout(
          () =>
            resolve({
              data: null,
              error: { message: "RPC_TIMEOUT", code: "PGRST202" },
            }),
          10_000
        )
      ),
    ])) as {
      data: unknown;
      error: { message?: string; code?: string; details?: string } | null;
    };

    if (!rpcResult.error && rpcResult.data) {
      const payload = rpcResult.data as {
        old?: { patient_id?: string; created_at?: string };
        data?: { patient_id?: string };
      };
      const patientId = String(payload.data?.patient_id ?? payload.old?.patient_id ?? "");

      void logAudit({
        clinicId,
        module: "clinical",
        what: "Modificó fecha de consulta clínica",
        entityType: "clinical_record",
        entityId: idParsed.data,
        patientId: patientId || undefined,
        action: "update",
        oldValues: { created_at: payload.old?.created_at },
        newValues: { created_at: consultationAt },
      });

      // Soft cache invalidation only — avoid blocking the action on a full page rebuild.
      if (patientId) revalidatePath(`/pacientes/${patientId}`, "page");
      revalidatePath("/consultas");
      return { success: true as const, patientId: patientId || null };
    }

    const rpcError = rpcResult.error;
    const canFallback =
      !rpcError ||
      isMissingRpcInSchemaCache(rpcError) ||
      rpcError.message === "RPC_TIMEOUT" ||
      /sync_clinical_record_related_dates|update_clinical_record_consultation_at/i.test(
        `${rpcError.message ?? ""} ${"details" in rpcError ? String(rpcError.details ?? "") : ""}`
      );

    if (!canFallback) {
      return {
        error: resolvePostgresUserMessage(rpcError, {
          fallback: "No se pudo actualizar la fecha de la consulta.",
        }),
      };
    }

    // Fallback: full atomic update with existing structured JSON (no child wipe).
    const { data: record, error: fetchError } = await supabase
      .from("clinical_records")
      .select(
        "id, patient_id, professional_id, appointment_id, chief_complaint, diagnosis, evolution, indications, diagnosis_cie10, diagnoses_json, treatments_json"
      )
      .eq("id", idParsed.data)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (fetchError) return { error: fetchError.message };
    if (!record) return { error: "Consulta no encontrada." };
    if (!record.professional_id) {
      return { error: "Esta evolución no tiene profesional asignado y no se puede editar." };
    }

    const formData = new FormData();
    formData.set("patient_id", record.patient_id);
    formData.set("professional_id", record.professional_id);
    if (record.appointment_id) formData.set("appointment_id", record.appointment_id);
    formData.set("chief_complaint", record.chief_complaint ?? "");
    formData.set("diagnosis", record.diagnosis ?? "");
    formData.set("evolution", record.evolution ?? "");
    formData.set("indications", record.indications ?? "");
    formData.set("consultation_at", consultationAt);
    if (record.diagnosis_cie10) formData.set("diagnosis_cie10", record.diagnosis_cie10);
    formData.set(
      "diagnoses_json",
      typeof record.diagnoses_json === "string"
        ? record.diagnoses_json
        : JSON.stringify(record.diagnoses_json ?? [])
    );
    formData.set(
      "treatments_json",
      typeof record.treatments_json === "string"
        ? record.treatments_json
        : JSON.stringify(record.treatments_json ?? [])
    );

    const persisted = await persistClinicalRecordUpdate(
      idParsed.data,
      formData,
      gate.access,
      gate.ctx,
      supabase
    );
    if ("error" in persisted && persisted.error) return persisted;

    // After atomic update (child sync may insert with now()), realign related dates.
    await Promise.all([
      supabase
        .from("clinical_record_diagnoses")
        .update({ created_at: consultationAt, updated_at: new Date().toISOString() })
        .eq("clinical_record_id", idParsed.data)
        .eq("clinic_id", clinicId),
      supabase
        .from("clinical_record_treatments")
        .update({ created_at: consultationAt, updated_at: new Date().toISOString() })
        .eq("clinical_record_id", idParsed.data)
        .eq("clinic_id", clinicId),
      supabase
        .from("prescription_drafts")
        .update({ created_at: consultationAt, updated_at: new Date().toISOString() })
        .eq("clinical_record_id", idParsed.data)
        .eq("clinic_id", clinicId),
    ]);

    return { success: true as const, patientId: record.patient_id };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la fecha de la consulta.",
    };
  }
}

export async function updateClinicalRecordNotes(
  recordId: string,
  fields: {
    chief_complaint: string;
    evolution: string;
    diagnosis?: string;
    indications?: string;
  }
) {
  const [gate, supabase] = await Promise.all([gateClinicalRecordWrite(), createClient()]);
  if (!gate.ok) return { error: gate.error };
  const { clinicId } = gate.access;

  const idParsed = parseEntityId(recordId, "Consulta");
  if (!idParsed.ok) return { error: idParsed.error };

  const { data: record, error: fetchError } = await supabase
    .from("clinical_records")
    .select(
      "id, patient_id, professional_id, appointment_id, chief_complaint, diagnosis, evolution, indications, created_at"
    )
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!record) return { error: "Consulta no encontrada." };
  if (!record.professional_id) {
    return { error: "Esta evolución no tiene profesional asignado y no se puede editar." };
  }

  const formData = new FormData();
  formData.set("patient_id", record.patient_id);
  formData.set("professional_id", record.professional_id);
  if (record.appointment_id) formData.set("appointment_id", record.appointment_id);
  formData.set("chief_complaint", fields.chief_complaint);
  formData.set("diagnosis", fields.diagnosis ?? record.diagnosis ?? "");
  formData.set("evolution", fields.evolution);
  formData.set("indications", fields.indications ?? record.indications ?? "");
  formData.set("consultation_at", record.created_at);

  return persistClinicalRecordUpdate(idParsed.data, formData, gate.access, gate.ctx, supabase);
}

export async function updateClinicalRecord(id: string, formData: FormData) {
  const [gate, supabase] = await Promise.all([gateClinicalRecordWrite(), createClient()]);
  if (!gate.ok) return { error: gate.error };

  const idParsed = parseEntityId(id, "Consulta");
  if (!idParsed.ok) return { error: idParsed.error };

  return persistClinicalRecordUpdate(idParsed.data, formData, gate.access, gate.ctx, supabase);
}

async function persistClinicalRecordUpdate(
  recordId: string,
  formData: FormData,
  access: ClinicWriteAccess,
  ctx: AuditRequestContext,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { parsed } = parseClinicalRecordForm(formData);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const ownership = await verifyClinicalRecordForeignKeys(supabase, access.clinicId, {
    patientId: parsed.data.patient_id,
    professionalId: parsed.data.professional_id,
    appointmentId: parsed.data.appointment_id,
  });
  if (!ownership.ok) return { error: ownership.error };

  const result = await updateClinicalRecordEntry(supabase, {
    recordId,
    clinicId: access.clinicId,
    userId: access.userId,
    parsed: parsed.data,
    auditContext: ctx,
  });

  if (!result.ok) return { error: result.error };

  await logAudit({
    clinicId: access.clinicId,
    module: "clinical",
    what: "Modificó consulta clínica (SOAP)",
    entityType: "clinical_record",
    entityId: recordId,
    patientId: String(result.data.old.patient_id),
    action: "update",
    oldValues: result.data.old,
    newValues: result.data.data,
  });

  revalidatePath(`/historias/${recordId}`, "page");
  revalidatePath(`/pacientes/${String(result.data.data.patient_id)}`, "page");
  revalidatePath("/consultas");
  return { success: true };
}

/**
 * Phase 7 — Soft lifecycle change (archive / superseded / corrected).
 * Never hard-deletes clinical content.
 */
export async function archiveClinicalRecord(
  recordId: string,
  options?: {
    reason?: string;
    lifecycle?: Exclude<ClinicalLifecycleStatus, "active">;
  }
) {
  const [gate, supabase] = await Promise.all([gateClinicalRecordWrite(), createClient()]);
  if (!gate.ok) return { error: gate.error };
  const { clinicId } = gate.access;

  const idParsed = parseEntityId(recordId, "Consulta");
  if (!idParsed.ok) return { error: idParsed.error };

  const lifecycle = options?.lifecycle ?? "archived";
  if (!isArchivableLifecycle(lifecycle)) {
    return { error: "Estado de ciclo de vida inválido." };
  }

  const { data, error } = await supabase.rpc(
    "archive_clinical_record" as never,
    {
      p_clinic_id: clinicId,
      p_record_id: idParsed.data,
      p_reason: options?.reason?.trim() || null,
      p_lifecycle: lifecycle,
    } as never
  );

  if (error) return { error: error.message };
  if (!data) return { error: "No se pudo archivar la consulta." };

  const patientId =
    typeof data === "object" && data && "patient_id" in data
      ? String((data as { patient_id: string }).patient_id)
      : null;

  await logAudit({
    clinicId,
    module: "clinical",
    what: `${clinicalLifecycleLabel(lifecycle)} consulta clínica (sin borrado físico)`,
    entityType: "clinical_record",
    entityId: idParsed.data,
    patientId: patientId ?? undefined,
    action: "update",
    newValues: {
      lifecycle_status: lifecycle,
      archive_reason: options?.reason?.trim() || null,
    },
  });

  revalidatePath(`/historias/${idParsed.data}`, "page");
  if (patientId) revalidatePath(`/pacientes/${patientId}`, "page");
  revalidatePath("/consultas");
  return { success: true, lifecycle };
}
