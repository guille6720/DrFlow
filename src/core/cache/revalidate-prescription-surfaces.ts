import { revalidatePath } from "next/cache";

export type PrescriptionRevalidationContext = {
  patientId: string;
  clinicalRecordId?: string | null;
};

/**
 * Invalidate only surfaces that show prescriptions.
 * Skips list routes and the /recetas redirect stub.
 */
export function revalidatePrescriptionSurfaces(ctx: PrescriptionRevalidationContext): void {
  revalidatePath(`/pacientes/${ctx.patientId}`, "page");
  if (ctx.clinicalRecordId) {
    revalidatePath(`/historias/${ctx.clinicalRecordId}`, "page");
  }
  revalidatePath("/consultas");
}
