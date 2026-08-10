import { pathologyDrugsTag } from "@/core/cache/cache-tags";
import { createClient } from "@/core/supabase/server";

import { withReferenceDataCache } from "@/lib/server/clinic-metadata-unstable-cache";
import type { PathologyDrug } from "@/types/pharmacology";

/**
 * Global pharmacology reference: drugs linked to a pathology.
 * Safe to cache cross-request (no PHI, low write frequency).
 * Search/typeahead RPCs are NOT cached — queries are user-specific.
 */
export function loadPathologyDrugsCached(pathologyId: string): Promise<PathologyDrug[]> {
  return withReferenceDataCache(
    ["pathology-drugs", pathologyId],
    pathologyDrugsTag(pathologyId),
    3600,
    async (supabase) => {
      const { data, error } = await supabase
        .from("pathology_drugs")
        .select(
          "id, pathology_id, drug_id, treatment_line, priority, indication_notes, dosage_reference, drugs(id, name, active_ingredient, atc_code, atc_description, presentation, route)"
        )
        .eq("pathology_id", pathologyId)
        .eq("is_active", true)
        .order("treatment_line")
        .order("priority");

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as unknown as PathologyDrug[];
    }
  );
}

/** Fallback when service role is unavailable (tests). */
export async function loadPathologyDrugsUncached(pathologyId: string): Promise<PathologyDrug[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pathology_drugs")
    .select(
      "id, pathology_id, drug_id, treatment_line, priority, indication_notes, dosage_reference, drugs(id, name, active_ingredient, atc_code, atc_description, presentation, route)"
    )
    .eq("pathology_id", pathologyId)
    .eq("is_active", true)
    .order("treatment_line")
    .order("priority");

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PathologyDrug[];
}
