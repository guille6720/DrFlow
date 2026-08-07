/**
 * @deprecated Import from `@/features/pami/types/pami-planilla-template` and
 * `@/features/pami/utils/render-pami-planilla` instead.
 * Runtime catalog is loaded from DB via loadPamiPlanillaCatalog().
 */
import { PAMI_PLANILLA_FALLBACK_CATALOG } from "@/features/pami/seed/pami-planilla-fallback-catalog";

export type {
  PamiPlanillaCategory,
  PamiPlanillaTemplate,
} from "@/features/pami/types/pami-planilla-template";
export { renderPamiPlanilla } from "@/features/pami/utils/render-pami-planilla";

export { PAMI_PLANILLA_FALLBACK_CATALOG };

/** @deprecated Use catalog.categories from loadPamiPlanillaCatalog(). */
export const PAMI_PLANILLA_CATEGORIES = PAMI_PLANILLA_FALLBACK_CATALOG.categories;

/** @deprecated Use catalog.templates from loadPamiPlanillaCatalog(). */
export const PAMI_PLANILLA_TEMPLATES = PAMI_PLANILLA_FALLBACK_CATALOG.templates;
