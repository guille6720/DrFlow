import { revalidatePath } from "next/cache";

export type MedicalOrderRevalidationContext = {
  patientId: string;
  /** When an update moves the order to another patient (rare). */
  previousPatientId?: string | null;
  clinicalRecordId?: string | null;
  /** When an update moves the order to another consulta. */
  previousClinicalRecordId?: string | null;
};

function revalidatePatientWorkspace(patientId: string): void {
  revalidatePath(`/pacientes/${patientId}`, "page");
}

function revalidateClinicalRecordEmbed(recordId: string): void {
  revalidatePath(`/historias/${recordId}`, "page");
}

/**
 * Invalidate only UI surfaces that display medical orders.
 * Skips list routes (/pacientes, /historias) and the /recetas redirect.
 *
 * Medical orders are PHI and are not cross-request cached (see docs/CACHE_STRATEGY.md),
 * so path-level invalidation is used instead of cacheTag/revalidateTag.
 */
export function revalidateMedicalOrderSurfaces(ctx: MedicalOrderRevalidationContext): void {
  const patientIds = new Set<string>([ctx.patientId]);
  if (ctx.previousPatientId && ctx.previousPatientId !== ctx.patientId) {
    patientIds.add(ctx.previousPatientId);
  }
  for (const patientId of patientIds) {
    revalidatePatientWorkspace(patientId);
  }

  const recordIds = new Set<string>();
  if (ctx.clinicalRecordId) recordIds.add(ctx.clinicalRecordId);
  if (
    ctx.previousClinicalRecordId &&
    ctx.previousClinicalRecordId !== ctx.clinicalRecordId
  ) {
    recordIds.add(ctx.previousClinicalRecordId);
  }
  for (const recordId of recordIds) {
    revalidateClinicalRecordEmbed(recordId);
  }
}
