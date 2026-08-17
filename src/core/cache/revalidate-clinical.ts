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
