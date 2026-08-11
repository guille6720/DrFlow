import type { MedicationCatalogResult, PamiVademecumResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

function parseConcentrationFromPresentation(presentation: string): string {
  const match = presentation.match(/\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|%|ui|u\.?i\.?)/i);
  return match?.[0]?.replace(/\s+/g, " ") ?? "";
}

/** Maps a national catalog row to a prescription medication line. */
export function catalogToPrescription(item: MedicationCatalogResult): PrescriptionMedication {
  return {
    generic_name: item.active_ingredient.trim(),
    brand_name: item.brand_name.trim(),
    presentation: item.presentation.trim(),
    concentration: parseConcentrationFromPresentation(item.presentation),
    quantity: 1,
    posology: "",
    route: "oral",
    vademecum_code: item.product_code?.trim() || undefined,
    search_source: "catalog",
  };
}

/** @deprecated Use catalogToPrescription */
export function vademecumToPrescription(
  item: PamiVademecumResult | MedicationCatalogResult
): PrescriptionMedication {
  const normalized: MedicationCatalogResult =
    "catalog_source" in item && item.catalog_source
      ? item
      : {
          id: item.id,
          catalog_source: "alfabeta",
          product_code:
            "alfabeta_id" in item && item.alfabeta_id != null
              ? String(item.alfabeta_id)
              : item.product_code ?? null,
          active_ingredient: item.active_ingredient,
          brand_name: item.brand_name,
          presentation: item.presentation,
          laboratory: item.laboratory,
          reference_price:
            "pvp_amount" in item ? (item.pvp_amount ?? item.reference_price ?? null) : item.reference_price,
          coverage_pct: item.coverage_pct,
          affiliate_amount: item.affiliate_amount,
          price_list_date: item.price_list_date,
        };
  return catalogToPrescription(normalized);
}

export function formatVademecumPrescriptionLabel(
  item: Pick<MedicationCatalogResult, "brand_name" | "presentation">
): string {
  return `${item.brand_name} ${item.presentation}`.trim();
}

export function formatVademecumPrescriptionSubtitle(
  item: Pick<MedicationCatalogResult, "active_ingredient" | "laboratory" | "catalog_source">
): string {
  const sourceLabel =
    item.catalog_source === "alfabeta"
      ? "Alfabeta"
      : item.catalog_source === "siafar"
        ? "SIAFAR"
        : item.catalog_source === "anmat"
          ? "ANMAT"
          : null;
  return [item.active_ingredient, item.laboratory, sourceLabel].filter(Boolean).join(" · ");
}
