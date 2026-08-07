import type { PamiPlanillaCatalogDbClient } from "@/features/pami/repositories/pami-planilla-catalog-db";
import { fetchPamiPlanillaCatalogFromDb } from "@/features/pami/repositories/pami-planilla-templates.repository";
import { PAMI_PLANILLA_FALLBACK_CATALOG } from "@/features/pami/seed/pami-planilla-fallback-catalog";
import type { PamiPlanillaCatalog } from "@/features/pami/types/pami-planilla-template";
export type PamiPlanillaCatalogSource = "database" | "fallback";

export type PamiPlanillaCatalogResult = {
  catalog: PamiPlanillaCatalog;
  source: PamiPlanillaCatalogSource;
};

/**
 * Loads the active PAMI planilla catalog for a clinic.
 * Falls back to bundled seed when DB is empty or RPC is unavailable (pre-migration).
 */
export async function loadPamiPlanillaCatalog(
  db: PamiPlanillaCatalogDbClient,
  clinicId: string
): Promise<PamiPlanillaCatalogResult> {
  const fromDb = await fetchPamiPlanillaCatalogFromDb(db, clinicId);
  if (fromDb && fromDb.templates.length > 0) {
    return { catalog: fromDb, source: "database" };
  }

  return { catalog: PAMI_PLANILLA_FALLBACK_CATALOG, source: "fallback" };
}

export function getDefaultPlanillaCategory(catalog: PamiPlanillaCatalog): string {
  return catalog.categories[0]?.id ?? catalog.templates[0]?.category ?? "internacion_domiciliaria";
}

export function getDefaultPlanillaTemplateId(
  catalog: PamiPlanillaCatalog,
  category: string
): string {
  const inCategory = catalog.templates.filter((t) => t.category === category);
  return inCategory[0]?.id ?? catalog.templates[0]?.id ?? "";
}
