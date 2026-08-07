import { describe, expect, it } from "vitest";

import type { PamiPlanillaCatalogDbClient } from "@/features/pami/repositories/pami-planilla-catalog-db";
import { PAMI_PLANILLA_FALLBACK_CATALOG } from "@/features/pami/seed/pami-planilla-fallback-catalog";
import {
  getDefaultPlanillaCategory,
  getDefaultPlanillaTemplateId,
  loadPamiPlanillaCatalog,
} from "@/features/pami/services/pami-planilla-templates.service";

describe("pami-planilla-templates.service", () => {
  it("falls back when RPC is unavailable", async () => {
    const db: PamiPlanillaCatalogDbClient = {
      rpc: async () => ({ data: null, error: { message: "function does not exist" } }),
    };

    const result = await loadPamiPlanillaCatalog(db, "clinic-1");
    expect(result.source).toBe("fallback");
    expect(result.catalog.templates).toHaveLength(9);
  });

  it("uses database catalog when RPC returns templates", async () => {
    const db: PamiPlanillaCatalogDbClient = {
      rpc: async () => ({
        data: {
          categories: [{ id: "insumos", label: "Insumos", description: "" }],
          templates: [
            {
              id: "insumos-panales",
              category: "insumos",
              title: "Test",
              template: "Hola {{paciente_nombre}}",
              fields: [{ key: "insumos", label: "Insumos" }],
            },
          ],
        },
        error: null,
      }),
    };

    const result = await loadPamiPlanillaCatalog(db, "clinic-1");
    expect(result.source).toBe("database");
    expect(result.catalog.templates[0]?.id).toBe("insumos-panales");
  });

  it("resolves default category and template", () => {
    expect(getDefaultPlanillaCategory(PAMI_PLANILLA_FALLBACK_CATALOG)).toBe(
      "internacion_domiciliaria"
    );
    expect(
      getDefaultPlanillaTemplateId(PAMI_PLANILLA_FALLBACK_CATALOG, "insumos")
    ).toBe("insumos-panales");
  });
});
