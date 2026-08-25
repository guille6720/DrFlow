import { NextResponse } from "next/server";

import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { executeCreateTurnoWizard } from "@/features/turnos/server/create-turno-wizard-core";

export const POST = withObservabilityApiRoute("turnos_wizard_create", async (request, ctx) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  const result = await executeCreateTurnoWizard(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, appointmentId: result.appointmentId });
});
