"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/auth/session";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";
import { waitingRoomStatusSchema } from "@/lib/validations/cash-schemas";
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ waiting_room_status: parsed.data })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .select("id, waiting_room_status")
    .single();

  if (error) return { error: error.message };

  if (parsed.data === "absent") {
    await supabase
      .from("appointments")
      .update({ status: "no_show" })
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId);
  }
  if (parsed.data === "cancelled") {
    await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId);
  }
  if (parsed.data === "finished") {
    await supabase
      .from("appointments")
      .update({ status: "attended" })
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId);
  }

  await logAudit({
    clinicId,
    entityType: "appointment",
    entityId: appointmentId,
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
