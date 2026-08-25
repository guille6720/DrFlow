"use client";

import type { WaitingRoomStatus } from "@/lib/constants/cash-register";

export type UpdateWaitingRoomRequestResult =
  | { success: true; v?: string; data?: unknown }
  | { error: string; v?: string };

/** Shared client waiting-room update — no server actions (avoids RSC refresh crash). */
export async function updateWaitingRoomRequest(
  appointmentId: string,
  status: WaitingRoomStatus
): Promise<UpdateWaitingRoomRequestResult> {
  const response = await fetch("/api/waiting-room/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ appointmentId, status }),
  });

  let data: UpdateWaitingRoomRequestResult;
  try {
    data = (await response.json()) as UpdateWaitingRoomRequestResult;
  } catch {
    return { error: `No se pudo actualizar la asistencia (HTTP ${response.status})` };
  }

  if ("error" in data) {
    return {
      error: data.error || `No se pudo actualizar la asistencia (HTTP ${response.status})`,
      v: data.v,
    };
  }
  if (!response.ok || !data.success) {
    return { error: `No se pudo actualizar la asistencia (HTTP ${response.status})` };
  }
  return data;
}
