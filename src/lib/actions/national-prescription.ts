"use server";

import { z } from "zod";

import {
  cancelNationalPrescriptionForSession,
  loadNationalPrescriptionStatus,
  type NationalRxStatusView,
  refreshNationalPrescriptionForSession,
  submitNationalPrescriptionForSession,
} from "@/core/renapdis/national-prescription/national-prescription.server";
import type { NationalRxResult } from "@/core/renapdis/national-prescription/types";
import { parseEntityId } from "@/core/validations/params";

/** Client-facing result: fixed messages and non-sensitive fields only. */
export type NationalPrescriptionActionResult =
  | { ok: true; outcome: string; state: string; sandboxReference: string | null; cuir: string | null }
  | { ok: false; code: string; message: string; state: string | null; recoverable: boolean };

function toClient(result: NationalRxResult): NationalPrescriptionActionResult {
  if (result.ok) {
    return {
      ok: true,
      outcome: result.outcome,
      state: result.state,
      sandboxReference: result.sandboxReference,
      cuir: result.cuir,
    };
  }
  return { ok: false, code: result.code, message: result.message, state: result.state, recoverable: result.recoverable };
}

const invalidId = (message: string): NationalPrescriptionActionResult => ({
  ok: false,
  code: "invalid_request",
  message,
  state: null,
  recoverable: false,
});

export async function submitNationalPrescriptionAction(prescriptionId: string): Promise<NationalPrescriptionActionResult> {
  const id = parseEntityId(prescriptionId, "Receta");
  if (!id.ok) return invalidId(id.error);
  return toClient(await submitNationalPrescriptionForSession(id.data));
}

export async function refreshNationalPrescriptionAction(prescriptionId: string): Promise<NationalPrescriptionActionResult> {
  const id = parseEntityId(prescriptionId, "Receta");
  if (!id.ok) return invalidId(id.error);
  return toClient(await refreshNationalPrescriptionForSession(id.data));
}

const cancelReasonSchema = z.enum(["error_de_carga", "cambio_de_tratamiento", "paciente_desiste", "otro"]);

export async function cancelNationalPrescriptionAction(
  prescriptionId: string,
  reason: string
): Promise<NationalPrescriptionActionResult> {
  const id = parseEntityId(prescriptionId, "Receta");
  if (!id.ok) return invalidId(id.error);
  const parsedReason = cancelReasonSchema.safeParse(reason);
  if (!parsedReason.success) return invalidId("Motivo de anulación inválido.");
  return toClient(await cancelNationalPrescriptionForSession(id.data, parsedReason.data));
}

export async function getNationalPrescriptionStatusAction(prescriptionId: string): Promise<NationalRxStatusView | null> {
  const id = parseEntityId(prescriptionId, "Receta");
  if (!id.ok) return null;
  return loadNationalPrescriptionStatus(id.data);
}
