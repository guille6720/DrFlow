import { type NextRequest, NextResponse } from "next/server";

import { requireSameOriginMutation } from "@/core/security/csrf";

import { cancelAppointmentForClinic } from "@/features/agenda/server/cancel-appointment";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const csrfBlock = requireSameOriginMutation(request);
  if (csrfBlock) return csrfBlock;

  let body: { appointmentId?: unknown; category?: unknown };
  try {
    body = (await request.json()) as { appointmentId?: unknown; category?: unknown };
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";

  if (!appointmentId || !category) {
    return NextResponse.json({ error: "Faltan datos para cancelar el turno" }, { status: 400 });
  }

  try {
    const result = await cancelAppointmentForClinic({ appointmentId, category });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cancelar el turno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
