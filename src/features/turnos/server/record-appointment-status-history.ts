import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppointmentStatus } from "@/types/database";

type WaitingRoomStatus =
  | "waiting"
  | "confirmed"
  | "in_consultation"
  | "finished"
  | "cancelled"
  | "absent";

export async function recordAppointmentStatusHistory(
  supabase: SupabaseClient,
  input: {
    clinicId: string;
    appointmentId: string;
    fromStatus: AppointmentStatus | null;
    toStatus: AppointmentStatus;
    fromWaitingRoomStatus?: WaitingRoomStatus | null;
    toWaitingRoomStatus?: WaitingRoomStatus | null;
    changedBy?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.rpc("append_appointment_status_history", {
    p_clinic_id: input.clinicId,
    p_appointment_id: input.appointmentId,
    p_from_status: input.fromStatus,
    p_to_status: input.toStatus,
    p_from_waiting: input.fromWaitingRoomStatus ?? null,
    p_to_waiting: input.toWaitingRoomStatus ?? null,
    p_changed_by: input.changedBy ?? null,
    p_reason: input.reason ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}
