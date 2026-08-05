import { revalidatePath } from "next/cache";

/** Invalidate common surfaces after clinical/patient mutations. */
export function revalidateClinicalSurfaces(extraPaths: string[] = []) {
  revalidatePath("/historias");
  revalidatePath("/pacientes");
  for (const path of extraPaths) {
    revalidatePath(path);
  }
}
