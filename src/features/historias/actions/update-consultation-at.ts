"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.actions";
import {
  isMissingRpcInSchemaCache,
  resolvePostgresUserMessage,
} from "@/core/errors/postgres-error";
import { getAuditRequestContext } from "@/core/security/audit-context";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

type RpcOutcome = {
  data: unknown;
  error: { message?: string; code?: string; details?: string } | null;
};

/**
 * Move an existing clinical record to a new consultation datetime.
 * Same HC identity — only timestamps change (record + diagnoses + treatments + Rx/orders).
 * Never recreates the record or re-syncs children from JSON (that wiped treatments).
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
      return { success: true, patientId: patientId || null, consultationAt };
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

    // Direct cascade — same HC, new timestamps only (no child wipe via atomic JSON sync).
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
      return {
        error: resolvePostgresUserMessage(forceError, {
          fallback: "No se pudo actualizar la fecha de la consulta.",
        }),
      };
    }
    if (!forced) return { error: "Consulta no encontrada." };

    const stamp = { created_at: consultationAt, updated_at: new Date().toISOString() };
    await Promise.all([
      supabase
        .from("clinical_record_diagnoses")
        .update(stamp)
        .eq("clinical_record_id", idParsed.data)
        .eq("clinic_id", clinicId),
      supabase
        .from("clinical_record_treatments")
        .update(stamp)
        .eq("clinical_record_id", idParsed.data)
        .eq("clinic_id", clinicId),
      supabase
        .from("prescription_drafts")
        .update(stamp)
        .eq("clinical_record_id", idParsed.data)
        .eq("clinic_id", clinicId),
    ]);

    // Align issued_at only when the prescription was already issued.
    await supabase
      .from("prescription_drafts")
      .update({ issued_at: consultationAt, updated_at: stamp.updated_at })
      .eq("clinical_record_id", idParsed.data)
      .eq("clinic_id", clinicId)
      .not("issued_at", "is", null);

    await supabase
      .from("medical_orders")
      .update({
        created_at: consultationAt,
        issued_at: consultationAt,
        updated_at: stamp.updated_at,
      })
      .eq("clinical_record_id", idParsed.data)
      .eq("clinic_id", clinicId);

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
    return { success: true, patientId: forced.patient_id, consultationAt };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la fecha de la consulta.",
    };
  }
}
