import type { PamiVademecumResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

function parseConcentrationFromPresentation(presentation: string): string {
  const match = presentation.match(/\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|%|ui|u\.?i\.?)/i);
  return match?.[0]?.replace(/\s+/g, " ") ?? "";
}

/** Maps a PAMI vademécum row to a prescription medication line (Drapp-style pick). */
export function vademecumToPrescription(item: PamiVademecumResult): PrescriptionMedication {
  return {
    generic_name: item.active_ingredient.trim(),
    brand_name: item.brand_name.trim(),
    presentation: item.presentation.trim(),
    concentration: parseConcentrationFromPresentation(item.presentation),
    quantity: 1,
    posology: "",
    route: "oral",
    vademecum_code: String(item.alfabeta_id),
    search_source: "pami",
  };
}

export function formatVademecumPrescriptionLabel(item: PamiVademecumResult): string {
  return `${item.brand_name} ${item.presentation}`.trim();
}

export function formatVademecumPrescriptionSubtitle(item: PamiVademecumResult): string {
  return [item.active_ingredient, item.laboratory].filter(Boolean).join(" · ");
}
