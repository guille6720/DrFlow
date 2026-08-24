"use client";

export type CancelAppointmentRequestResult =
  | {
      success: true;
      v?: string;
      whatsapp: { phone: string; startAt: string; reason: string } | null;
    }
  | { error: string; v?: string };

/** Shared client cancel call — no server actions. */
export async function cancelAppointmentRequest(
  appointmentId: string,
  category: string
): Promise<CancelAppointmentRequestResult> {
  const response = await fetch("/api/appointments/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ appointmentId, category }),
  });

  let data: CancelAppointmentRequestResult;
  try {
    data = (await response.json()) as CancelAppointmentRequestResult;
  } catch {
    return { error: `No se pudo cancelar el turno (HTTP ${response.status})` };
  }

  if ("error" in data) {
    return {
      error: data.error || `No se pudo cancelar el turno (HTTP ${response.status})`,
      v: data.v,
    };
  }
  if (!response.ok || !data.success) {
    return { error: `No se pudo cancelar el turno (HTTP ${response.status})` };
  }
  return data;
}
