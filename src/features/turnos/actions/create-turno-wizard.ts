"use server";

import { executeCreateTurnoWizard } from "@/features/turnos/server/create-turno-wizard-core";

/** @deprecated Prefer POST /api/turnos/wizard from the client (avoids RSC refresh failures). */
export async function createTurnoWizard(input: unknown) {
  const result = await executeCreateTurnoWizard(input);
  if (!result.ok) return { error: result.error };
  return { ok: true as const, appointmentId: result.appointmentId };
}
