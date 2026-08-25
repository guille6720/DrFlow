"use server";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.actions";
import { revalidateAppointmentSurfaces } from "@/core/cache/revalidate-appointment-surfaces";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { createClient } from "@/core/supabase/server";
import { waitingRoomStatusSchema } from "@/core/validations/cash-schemas";
import { parseEntityId } from "@/core/validations/params";

import type { WaitingRoomStatus } from "@/lib/constants/cash-register";

export async function updateWaitingRoomStatus(
  appointmentId: string,
  status: WaitingRoomStatus
) {
  const [access, supabase] = await Promise.all([
    requireClinicPermission("manageWaitingRoom"),
    createClient(),
  ]);
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const parsed = waitingRoomStatusSchema.safeParse(status);
  if (!parsed.success) return { error: "Estado inválido" };

  const idParsed = parseEntityId(appointmentId, "Turno");
  if (!idParsed.ok) return { error: idParsed.error };
  const { data, error } = await supabase.rpc("update_waiting_room_status_atomic", {
    p_clinic_id: clinicId,
    p_appointment_id: idParsed.data,
    p_waiting_room_status: parsed.data,
  });

  if (error) {
    return { error: resolvePostgresUserMessage(error, { fallback: error.message }) };
  }

  await logAudit({
    clinicId,
    entityType: "appointment",
    entityId: idParsed.data,
    action: "update",
    metadata: { waiting_room_status: parsed.data },
  });

  try {
    revalidateAppointmentSurfaces({
      includeConsultasQueue: true,
      includeWaitingRoom: true,
    });
  } catch (revalidateErr) {
    console.error("[waiting-room] revalidate failed:", revalidateErr);
  }
  return { data };
}

export async function confirmAppointmentFromWaitingRoom(appointmentId: string) {
  return updateWaitingRoomStatus(appointmentId, "confirmed");
}
