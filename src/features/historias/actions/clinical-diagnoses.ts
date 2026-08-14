"use server";

import { getActiveClinic, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { searchQuerySchema } from "@/core/validations/params";

import type { ClinicalDiagnosisCatalogHit } from "@/features/historias/types/clinical-diagnosis-catalog";

export async function searchClinicalDiagnoses(
  query: string,
  limit = 10
): Promise<{ data?: ClinicalDiagnosisCatalogHit[]; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };

  const { role, isSuperadmin } = await getActiveClinic();
  if (!hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos para buscar diagnósticos" };
  }

  const queryParsed = searchQuerySchema.safeParse(query.trim());
  if (!queryParsed.success) return { data: [] };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_clinical_diagnoses", {
    p_query: queryParsed.data,
    p_limit: Math.min(Math.max(limit, 1), 25),
  });

  if (error) {
    return { error: "No se pudo buscar en el catálogo de diagnósticos." };
  }

  return {
    data: ((data ?? []) as ClinicalDiagnosisCatalogHit[]).map((row) => ({
      ...row,
      synonyms: Array.isArray(row.synonyms) ? row.synonyms : [],
    })),
  };
}
