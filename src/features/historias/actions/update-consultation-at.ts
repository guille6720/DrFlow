"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.actions";
import {
  isMissingRpcInSchemaCache,
  resolvePostgresUserMessage,
} from "@/core/errors/postgres-error";
import { getAuditRequestContext } from "@/core/security/audit-context";
import { verifyClinicalRecordForeignKeys } from "@/core/security/ownership-guard";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue, parseEntityId } from "@/core/validations/params";
import { clinicalRecordSchema } from "@/core/validations/schemas";

import { updateClinicalRecordEntry } from "@/features/historias/services/clinical-records.service";

/**
 * Date-only clinical record update.
 * Isolated "use server" module — Next.js rejects mixed non-async exports in action files.
 */
export async function updateClinicalRecordConsultationAt(
  recordId: string,
  consultationAtIso: string
) {
  try {
    const [access, ctx, supabase] = await Promise.all([
      requireClinicPermission("editClinicalRecords"),
      getAuditRequestContext(),
      createClient(),
    ]);
    if (!access.ok) return { error: access.error };

    const idParsed = parseEntityId(recordId, "Consulta");
    if (!idParsed.ok) return { error: idParsed.error };

    const parsedDate = new Date(consultationAtIso);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "Fecha de consulta inválida." };
    }
    const consultationAt = parsedDate.toISOString();
    const { clinicId, userId } = access;

    type RpcOutcome = {
      data: unknown;
      error: { message?: string; code?: string; details?: string } | null;
    };

    const rpcCall = Promise.resolve(
      supabase.rpc("update_clinical_record_consultation_at" as never, {
        p_clinic_id: clinicId,
        p_record_id: idParsed.data,
        p_consultation_at: consultationAt,
        p_updated_by: userId,
        p_audit_ip: ctx.ip_address,
        p_audit_user_agent: ctx.user_agent,
      } as never) as unknown as Promise<RpcOutcome>
    );

    const timedOut = { timedOut: true as const };
    const raced = await Promise.race([
      rpcCall.then((result) => ({ timedOut: false as const, result })),
      new Promise<typeof timedOut>((resolve) => {
        setTimeout(() => resolve(timedOut), 10_000);
      }),
    ]);

    if (!raced.timedOut && !raced.result.error && raced.result.data) {
      const payload = raced.result.data as {
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
        oldValues: { created_at: payload.old?.created_at ?? null },
        newValues: { created_at: consultationAt },
      });

      if (patientId) revalidatePath(`/pacientes/${patientId}`, "page");
      revalidatePath("/consultas");
      return { success: true, patientId: patientId || null };
    }

    const rpcError = raced.timedOut
      ? { message: "RPC_TIMEOUT", code: "PGRST202" }
      : raced.result.error;

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

    const parsed = clinicalRecordSchema.safeParse({
      patient_id: record.patient_id,
      professional_id: record.professional_id,
      appointment_id: record.appointment_id,
      chief_complaint: record.chief_complaint ?? "",
      diagnosis: record.diagnosis ?? "",
      evolution: record.evolution ?? "",
      indications: record.indications ?? "",
      consultation_at: consultationAt,
      diagnosis_cie10: record.diagnosis_cie10 ?? null,
      diagnoses_json:
        typeof record.diagnoses_json === "string"
          ? record.diagnoses_json
          : JSON.stringify(record.diagnoses_json ?? []),
      treatments_json:
        typeof record.treatments_json === "string"
          ? record.treatments_json
          : JSON.stringify(record.treatments_json ?? []),
    });
    if (!parsed.success) return { error: firstZodIssue(parsed.error) };

    const ownership = await verifyClinicalRecordForeignKeys(supabase, clinicId, {
      patientId: parsed.data.patient_id,
      professionalId: parsed.data.professional_id,
      appointmentId: parsed.data.appointment_id,
    });
    if (!ownership.ok) return { error: ownership.error };

    const result = await updateClinicalRecordEntry(supabase, {
      recordId: idParsed.data,
      clinicId,
      userId,
      parsed: parsed.data,
      auditContext: ctx,
    });

    // Atomic RPC may succeed without applying consultation_at on older overloads.
    // Always force created_at via direct update so the date actually persists.
    const { data: forced, error: forceError } = await supabase
      .from("clinical_records")
      .update({
        created_at: consultationAt,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", idParsed.data)
      .eq("clinic_id", clinicId)
      .select("id, created_at, patient_id")
      .maybeSingle();

    if (forceError) {
      if (!result.ok) return { error: result.error };
      return {
        error: resolvePostgresUserMessage(forceError, {
          fallback: "No se pudo actualizar la fecha de la consulta.",
        }),
      };
    }
    if (!forced) {
      return { error: result.ok ? "No se pudo actualizar la fecha de la consulta." : result.error };
    }

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

    void logAudit({
      clinicId,
      module: "clinical",
      what: "Modificó fecha de consulta clínica",
      entityType: "clinical_record",
      entityId: idParsed.data,
      patientId: forced.patient_id,
      action: "update",
      oldValues: { created_at: null },
      newValues: { created_at: consultationAt },
    });

    revalidatePath(`/pacientes/${forced.patient_id}`, "page");
    revalidatePath("/consultas");
    return { success: true, patientId: forced.patient_id };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la fecha de la consulta.",
    };
  }
}
