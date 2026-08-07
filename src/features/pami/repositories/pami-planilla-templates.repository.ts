import type { PamiPlanillaCatalogDbClient } from "@/features/pami/repositories/pami-planilla-catalog-db";
import type {
  PamiPlanillaCatalog,
  PamiPlanillaTemplate,
} from "@/features/pami/types/pami-planilla-template";

type CatalogRpcRow = {
  categories?: {
    id: string;
    label: string;
    description: string | null;
  }[];
  templates?: {
    id: string;
    category: string;
    title: string;
    template: string;
    fields?: {
      key: string;
      label: string;
      multiline?: boolean;
      placeholder?: string | null;
    }[];
  }[];
};

function mapRpcCatalog(payload: CatalogRpcRow | null | undefined): PamiPlanillaCatalog | null {
  if (!payload?.categories?.length || !payload?.templates?.length) {
    return null;
  }

  const categories = payload.categories.map((c) => ({
    id: c.id,
    label: c.label,
    description: c.description ?? "",
  }));

  const templates: PamiPlanillaTemplate[] = payload.templates.map((t) => ({
    id: t.id,
    category: t.category,
    title: t.title,
    template: t.template,
    fields: (t.fields ?? []).map((f) => ({
      key: f.key,
      label: f.label,
      multiline: f.multiline ?? false,
      placeholder: f.placeholder ?? undefined,
    })),
  }));

  return { categories, templates };
}

export async function fetchPamiPlanillaCatalogFromDb(
  db: PamiPlanillaCatalogDbClient,
  clinicId: string
): Promise<PamiPlanillaCatalog | null> {
  const { data, error } = await db.rpc("get_pami_planilla_catalog", {
    p_clinic_id: clinicId,
  });

  if (error) {
    return null;
  }

  return mapRpcCatalog(data as CatalogRpcRow);
}
