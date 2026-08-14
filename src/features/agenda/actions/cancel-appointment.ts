"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { getSession } from "@/core/auth/session.server";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { recordAudit } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";
import { sanitizeText } from "@/core/validations/schemas";

import { recordAppointmentStatusHistory } from "@/features/turnos/server/record-appointment-status-history";
import {
  CANCELLATION_REASON_OPTIONS,
  type CancellationCategory,
  formatCancellationReason,
} from "@/features/turnos/utils/appointment-lifecycle";

const CATEGORY_VALUES = new Set(
  CANCELLATION_REASON_OPTIONS.map((option) => option.value)
);

function isCancellationCategory(value: string): value is CancellationCategory {
  return CATEGORY_VALUES.has(value as CancellationCategory);
}

export type CancelAppointmentResult =
  | {
      success: true;
      whatsapp: { phone: string; startAt: string } | null;
    }
  | { error: string };

/** Cancels a staff appointment with a structured reason category. */
export async function cancelAppointment(input: {
  appointmentId: string;
  category: string;
}): Promise<CancelAppointmentResult> {
  try {
    const access = await requireClinicPermission("manageAppointments");
    if (!access.ok) return { error: access.error };

    const idParsed = parseEntityId(input.appointmentId, "Turno");
    if (!idParsed.ok) return { error: idParsed.error };

    if (!isCancellationCategory(input.category)) {
      return { error: "Motivo de cancelación inválido" };
    }

    const reason = sanitizeText(formatCancellationReason(input.category).slice(0, 500));
    const { clinicId } = access;
    const user = await getSession();
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

    // Schema drift fallbacks for older environments.
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

    void recordAppointmentStatusHistory(supabase, {
      clinicId,
      appointmentId: idParsed.data,
      fromStatus: before.status,
      toStatus: "cancelled",
      fromWaitingRoomStatus: before.waiting_room_status ?? null,
      toWaitingRoomStatus: "cancelled",
      changedBy: user?.id ?? null,
      reason,
    }).catch(() => {
      // Non-blocking
    });

    void recordAudit({
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

    revalidatePath("/agenda");
    revalidatePath("/turnos/agenda");
    revalidatePath("/dashboard");
    if (before.patient_id) revalidatePath(`/pacientes/${before.patient_id}`);
    revalidatePath("/atenciones");
    revalidatePath("/sala-espera");

    const patient = before.patients as
      | { phone?: string | null }
      | { phone?: string | null }[]
      | null;
    const patientRow = Array.isArray(patient) ? patient[0] : patient;

    return {
      success: true,
      whatsapp: patientRow?.phone
        ? { phone: patientRow.phone, startAt: before.start_at as string }
        : null,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo cancelar el turno",
    };
  }
}
