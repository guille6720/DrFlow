import "server-only";

import { revalidatePath } from "next/cache";

import { getActiveClinicId, getPermissionContext, getSession } from "@/core/auth/session";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { hasPermission } from "@/core/permissions/roles";
import { recordAudit } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import { recordAppointmentStatusHistory } from "@/features/turnos/server/record-appointment-status-history";

const CATEGORY_LABELS: Record<string, string> = {
  patient: "Paciente",
  professional: "Profesional",
  clinic: "Clínica",
  data_error: "Error de carga",
  other: "Otro",
};

export type CancelAppointmentResult =
  | {
      success: true;
      whatsapp: { phone: string; startAt: string; reason: string } | null;
    }
  | { error: string };

/** Core cancel logic — API route only. Avoid `"use server"` import graphs. */
export async function cancelAppointmentForClinic(input: {
  appointmentId: string;
  category: string;
}): Promise<CancelAppointmentResult> {
  try {
    if (typeof getActiveClinicId !== "function" || typeof getPermissionContext !== "function") {
      return { error: "Sesión no disponible (auth)" };
    }
    if (typeof hasPermission !== "function") {
      return { error: "Permisos no disponibles" };
    }

    const clinicId = await getActiveClinicId();
    const { role, isSuperadmin, permissionOverrides } = await getPermissionContext();

    if (!clinicId || !hasPermission(role, "manageAppointments", isSuperadmin, permissionOverrides)) {
      return { error: "Sin permisos" };
    }

    const idParsed = parseEntityId(input.appointmentId, "Turno");
    if (!idParsed.ok) return { error: idParsed.error };

    if (!(input.category in CATEGORY_LABELS)) {
      return { error: "Motivo de cancelación inválido" };
    }

    const reason = (CATEGORY_LABELS[input.category] ?? "Otro").slice(0, 500);
    const user = typeof getSession === "function" ? await getSession() : null;
    const supabase = await createClient();

    const { data: before, error: loadError } = await supabase
      .from("appointments")
      .select(
        "id, start_at, end_at, patient_id, status, waiting_room_status, patients(first_name, last_name, phone)"
      )
      .eq("id", idParsed.data)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (loadError) {
      return {
        error: resolvePostgresUserMessage(loadError, {
          fallback: "No se pudo cargar el turno",
        }),
      };
    }
    if (!before) return { error: "Turno no encontrado" };
    if (before.status === "cancelled") return { error: "El turno ya está cancelado" };
    if (before.status === "attended") {
      return { error: "No se puede cancelar un turno ya atendido" };
    }

    const updatePayload: Record<string, unknown> = {
      status: "cancelled",
      cancellation_reason: reason,
      cancellation_category: input.category,
      cancelled_at: new Date().toISOString(),
      cancelled_by: user?.id ?? null,
      cancelled_by_type: "clinic",
      waiting_room_status: "cancelled",
    };

    let { error } = await supabase
      .from("appointments")
      .update(updatePayload)
      .eq("id", idParsed.data)
      .eq("clinic_id", clinicId);

    if (error && /cancellation_category|waiting_room_status/i.test(error.message ?? "")) {
      const { cancellation_category: _c, waiting_room_status: _w, ...fallback } = updatePayload;
      ({ error } = await supabase
        .from("appointments")
        .update(fallback)
        .eq("id", idParsed.data)
        .eq("clinic_id", clinicId));
    }

    if (error) {
      return {
        error: resolvePostgresUserMessage(error, { fallback: error.message }),
      };
    }

    try {
      await recordAppointmentStatusHistory(supabase, {
        clinicId,
        appointmentId: idParsed.data,
        fromStatus: before.status,
        toStatus: "cancelled",
        fromWaitingRoomStatus: before.waiting_room_status ?? null,
        toWaitingRoomStatus: "cancelled",
        changedBy: user?.id ?? null,
        reason,
      });
    } catch {
      // Non-blocking
    }

    try {
      await recordAudit({
        clinicId,
        entityType: "appointment",
        entityId: idParsed.data,
        action: "update",
        metadata: {
          status: "cancelled",
          cancellationReason: reason,
          cancelledBy: "clinic",
        },
      });
    } catch {
      // Non-blocking
    }

    try {
      if (typeof revalidatePath === "function") {
        revalidatePath("/agenda");
        revalidatePath("/turnos/agenda");
        revalidatePath("/dashboard");
        if (before.patient_id) revalidatePath(`/pacientes/${before.patient_id}`);
        revalidatePath("/atenciones");
        revalidatePath("/sala-espera");
      }
    } catch {
      // Non-blocking — client refresh covers UI
    }

    const patient = before.patients as
      | { phone?: string | null }
      | { phone?: string | null }[]
      | null;
    const patientRow = Array.isArray(patient) ? patient[0] : patient;

    return {
      success: true,
      whatsapp: patientRow?.phone
        ? {
            phone: patientRow.phone,
            startAt: String(before.start_at),
            reason,
          }
        : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cancelar el turno";
    return { error: message };
  }
}
