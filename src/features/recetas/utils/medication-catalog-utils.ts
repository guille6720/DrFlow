import type { MedicationSearchSource } from "@/features/recetas/engine/types";

export function usesMedicationCatalogSearch(source: MedicationSearchSource): boolean {
  return source === "medication_catalog" || source === "pami_vademecum";
}

export function medicationCatalogCodeLabel(catalogSource?: string | null): string {
  if (catalogSource === "alfabeta") return "Cód. Alfabeta";
  return "Cód. producto";
}

export function medicationCatalogSearchLabel(): string {
  return "Vademécum nacional (Alfabeta + SIAFAR)";
}
