"use server";

import { getActiveClinic, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { entityIdArraySchema, entityIdSchema, searchQuerySchema } from "@/core/validations/params";

import type {
  MedicationCatalogResult,
  PamiVademecumResult,
  PathologyBySymptomResult,
  PathologyDrug,
  PathologySearchResult,
  SymptomSearchResult,
} from "@/types/pharmacology";

async function assertPharmacologyAccess() {
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" as const };

  const { role, isSuperadmin } = await getActiveClinic();
  if (!hasPermission(role, "viewPharmacology", isSuperadmin)) {
    return { error: "Sin permisos para consultar referencia farmacológica" as const };
  }

  return { error: null as null };
}

export async function searchPathologies(
  query: string
): Promise<{ data?: PathologySearchResult[]; error?: string }> {
  const access = await assertPharmacologyAccess();
  if (access.error) return access;

  const queryParsed = searchQuerySchema.safeParse(query.trim());
  if (!queryParsed.success) {
    return { data: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_pathologies", {
    p_query: queryParsed.data,
    p_limit: 12,
  });

  if (error) {
    return { error: "No se pudo buscar patologías. Intentá de nuevo." };
  }

  return { data: (data ?? []) as PathologySearchResult[] };
}

export async function searchSymptoms(
  query: string
): Promise<{ data?: SymptomSearchResult[]; error?: string }> {
  const access = await assertPharmacologyAccess();
  if (access.error) return access;

  const queryParsed = searchQuerySchema.safeParse(query.trim());
  if (!queryParsed.success) {
    return { data: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_symptoms", {
    p_query: queryParsed.data,
    p_limit: 12,
  });

  if (error) {
    return { error: "No se pudo buscar síntomas. ¿Corriste la migración 011?" };
  }

  return { data: (data ?? []) as SymptomSearchResult[] };
}

export async function getPathologiesBySymptoms(
  symptomIds: string[]
): Promise<{ data?: PathologyBySymptomResult[]; error?: string }> {
  const access = await assertPharmacologyAccess();
  if (access.error) return access;

  if (symptomIds.length === 0) {
    return { data: [] };
  }

  const idsParsed = entityIdArraySchema.safeParse(symptomIds);
  if (!idsParsed.success) return { error: "Síntomas inválidos" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_pathologies_by_symptoms", {
    p_symptom_ids: idsParsed.data,
    p_limit: 12,
  });

  if (error) {
    return { error: "No se pudieron sugerir patologías para esos síntomas." };
  }

  return { data: (data ?? []) as PathologyBySymptomResult[] };
}

export async function searchMedicationCatalog(
  query: string
): Promise<{ data?: MedicationCatalogResult[]; error?: string }> {
  const access = await assertPharmacologyAccess();
  if (access.error) return access;

  const queryParsed = searchQuerySchema.safeParse(query.trim());
  if (!queryParsed.success) {
    return { data: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_medication_catalog", {
    p_query: queryParsed.data,
    p_limit: 24,
  });

  if (error) {
    return { error: "No se pudo buscar el vademécum. ¿Corriste la migración 107?" };
  }

  return { data: (data ?? []) as MedicationCatalogResult[] };
}

export async function searchPamiVademecum(
  query: string
): Promise<{ data?: PamiVademecumResult[]; error?: string }> {
  const result = await searchMedicationCatalog(query);
  if (result.error) return result;
  return {
    data: (result.data ?? []).map((row) => ({
      ...row,
      alfabeta_id: row.product_code && /^\d+$/.test(row.product_code)
        ? Number(row.product_code)
        : undefined,
      pvp_amount: row.reference_price,
    })),
  };
}

export async function getDrugsByPathology(
  pathologyId: string
): Promise<{ data?: PathologyDrug[]; error?: string }> {
  const access = await assertPharmacologyAccess();
  if (access.error) return access;

  const idParsed = entityIdSchema.safeParse(pathologyId);
  if (!idParsed.success) return { error: "Patología inválida" };

  try {
    const { loadPathologyDrugsCached } = await import("@/lib/server/cached-reference-data");
    const data = await loadPathologyDrugsCached(idParsed.data);
    return { data };
  } catch {
    return { error: "No se pudieron cargar los fármacos asociados." };
  }
}
