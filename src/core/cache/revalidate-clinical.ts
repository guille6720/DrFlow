import { revalidatePath } from "next/cache";

/**
 * Bulk clinical import: the patient list changed.
 * Skips `/historias` (redirect stub to `/pacientes?seccion=historias`).
 */
export function revalidateClinicalSurfaces(extraPaths: string[] = []) {
  revalidatePath("/pacientes");
  for (const path of extraPaths) {
    revalidatePath(path);
  }
}

/** After a consultation save, refresh HC and Consultas server data. */
export function revalidateClinicalConsultationSurfaces(patientId: string) {
  revalidatePath(`/pacientes/${patientId}`, "page");
  revalidatePath("/consultas", "page");
}
