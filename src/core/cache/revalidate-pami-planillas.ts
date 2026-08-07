import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";

import { clinicPamiPlanillasTag } from "@/core/cache/cache-tags";

/** Invalidate PAMI planilla catalog after template/category mutations. */
export function revalidatePamiPlanillaSurfaces(clinicId: string): void {
  updateTag(clinicPamiPlanillasTag(clinicId));
  revalidatePath("/pami/planillas", "page");
}
