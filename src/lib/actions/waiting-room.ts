"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { logAudit } from "@/core/auth/session";
import { requireClinicPermission } from "@/core/actions/clinic-guard";
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
  const { data, error } = await supabase
    .from("appointments")
    .update({ waiting_room_status: parsed.data })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .select("id, waiting_room_status")
    .single();

  if (error) return { error: error.message };

  if (parsed.data === "absent") {
    await supabase
      .from("appointments")
      .update({ status: "no_show" })
      .eq("id", idParsed.data)
      .eq("clinic_id", clinicId);
  }
  if (parsed.data === "cancelled") {
    await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", idParsed.data)
      .eq("clinic_id", clinicId);
  }
  if (parsed.data === "finished") {
    await supabase
      .from("appointments")
      .update({ status: "attended" })
      .eq("id", idParsed.data)
      .eq("clinic_id", clinicId);
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
