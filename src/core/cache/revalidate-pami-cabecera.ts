import { revalidatePath } from "next/cache";

import {
  revalidateClinicClinicalTemplatesCache,
  revalidateClinicSpecialtiesCache,
} from "@/core/cache/revalidate-clinic-cache";

/**
 * Invalidate only surfaces affected by `seed_pami_cabecera_for_clinic`.
 *
 * RPC changes:
 * - clinics.practice_profile, default_insurance, accepted_coverages, slot duration
 * - clinical_templates (insert)
 * - specialties (rename)
 * - consultation_reasons (insert — no cached consumer yet)
 *
 * Tags cover cross-request caches (templates → workspace / historias; specialties → agenda).
 * Page revalidation targets routes that read clinic row fields not in unstable_cache.
 */
export function revalidatePamiCabeceraSurfaces(_clinicId: string): void {
  revalidateClinicClinicalTemplatesCache(_clinicId);
  revalidateClinicSpecialtiesCache(_clinicId);

  revalidatePath("/configuracion", "page");
  revalidatePath("/guia-pami", "page");
  revalidatePath("/pacientes/nuevo", "page");
}
