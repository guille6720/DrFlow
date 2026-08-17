"use server";

import { getActiveClinic, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { searchQuerySchema } from "@/core/validations/params";

import type {
  ClinicalTreatmentCatalogHit,
  ClinicalTreatmentKind,
} from "@/features/historias/types/clinical-treatment-catalog";

export async function searchClinicalTreatments(
  query: string,
  options?: { limit?: number; kind?: Exclude<ClinicalTreatmentKind, "medication" | "free_text"> }
): Promise<{ data?: ClinicalTreatmentCatalogHit[]; error?: string }> {
  const [user, active, supabase] = await Promise.all([
    getSession(),
    getActiveClinic(),
    createClient(),
  ]);
  if (!user) return { error: "Sesión requerida" };

  const { role, isSuperadmin } = active;
  if (
    !hasPermission(role, "viewClinicalRecords", isSuperadmin) &&
    !hasPermission(role, "editClinicalRecords", isSuperadmin)
  ) {
    return { error: "Sin permisos para buscar tratamientos" };
  }

  const queryParsed = searchQuerySchema.safeParse(query.trim());
  if (!queryParsed.success) return { data: [] };
  const { data, error } = await supabase.rpc("search_clinical_treatments", {
    p_query: queryParsed.data,
    p_limit: Math.min(Math.max(options?.limit ?? 12, 1), 30),
    p_kind: options?.kind ?? null,
  });

  if (error) {
    return {
      error:
        "No se pudo buscar en el catálogo de tratamientos. ¿Está aplicada la migración 113 en Supabase?",
    };
  }

  return {
    data: ((data ?? []) as ClinicalTreatmentCatalogHit[]).map((row) => ({
      ...row,
      synonyms: Array.isArray(row.synonyms) ? row.synonyms : [],
    })),
  };
}
