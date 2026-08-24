import type { MedicationCatalogResult, PamiVademecumResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

function parseConcentrationFromPresentation(presentation: string): string {
  const match = presentation.match(/\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|%|ui|u\.?i\.?)/i);
  return match?.[0]?.replace(/\s+/g, " ") ?? "";
}

/** Extrae forma farmacéutica solo si ya figura en la presentación del catálogo. */
export function parsePharmaceuticalFormFromPresentation(presentation: string): string {
  const match = presentation.match(
    /\b(comprimidos?|c[aá]psulas?|jarabe|suspensi[oó]n|gotas|crema|ung[uü]ento|inyectable|ampollas?|parche|aerosol|soluci[oó]n|polvo|sobres?|ovulos?|supositorios?|gel|spray)\b/i
  );
  return match?.[0]?.replace(/\s+/g, " ") ?? "";
}

/**
 * Selección desde catálogo para MedicationAutocomplete / consulta.
 * Solo identidad de producto: no inventa dosis, frecuencia, duración ni vía.
 */
export function catalogToMedicationSelection(item: MedicationCatalogResult): PrescriptionMedication {
  const presentation = item.presentation.trim();
  const concentration = parseConcentrationFromPresentation(presentation);
  const pharmaceuticalForm = parsePharmaceuticalFormFromPresentation(presentation);
  const active = item.active_ingredient.trim();
  return {
    generic_name: active,
    active_ingredient: active,
    brand_name: item.brand_name.trim() || undefined,
    presentation: presentation || undefined,
    concentration: concentration || undefined,
    pharmaceutical_form: pharmaceuticalForm || undefined,
    quantity: 0,
    posology: "",
    dose: "",
    frequency: "",
    duration_days: undefined,
    route: "",
    instructions: "",
    vademecum_code: item.product_code?.trim() || undefined,
    search_source: "catalog",
  };
}

/** Maps a national catalog row to a prescription medication line (módulo recetas). */
export function catalogToPrescription(item: MedicationCatalogResult): PrescriptionMedication {
  const selection = catalogToMedicationSelection(item);
  return {
    ...selection,
    // En recetas se mantiene cantidad mínima operativa; la posología sigue vacía.
    quantity: 1,
    route: selection.route || "oral",
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
