"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.server";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { createClient } from "@/core/supabase/server";
import { waitingRoomStatusSchema } from "@/core/validations/cash-schemas";
import { parseEntityId } from "@/core/validations/params";

import type { WaitingRoomStatus } from "@/lib/constants/cash-register";

export async function updateWaitingRoomStatus(
  appointmentId: string,
  status: WaitingRoomStatus
) {
  const access = await requireClinicPermission("manageWaitingRoom");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const parsed = waitingRoomStatusSchema.safeParse(status);
  if (!parsed.success) return { error: "Estado inválido" };

  const idParsed = parseEntityId(appointmentId, "Turno");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
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

  revalidatePath("/sala-espera");
  revalidatePath("/agenda");
  return { data };
}

export async function confirmAppointmentFromWaitingRoom(appointmentId: string) {
  return updateWaitingRoomStatus(appointmentId, "confirmed");
}
