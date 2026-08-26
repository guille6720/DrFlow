"use server";

import { getActiveClinic, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { searchQuerySchema } from "@/core/validations/params";

import type { ClinicalDiagnosisCatalogHit } from "@/features/historias/types/clinical-diagnosis-catalog";

function mapDiagnosisRows(rows: ClinicalDiagnosisCatalogHit[]): ClinicalDiagnosisCatalogHit[] {
  return rows.map((row) => ({
    ...row,
    synonyms: Array.isArray(row.synonyms) ? row.synonyms : [],
  }));
}

/** Fallback when RPC EXECUTE is missing but RLS SELECT on clinical_diagnoses works. */
async function searchClinicalDiagnosesDirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
  limit: number
): Promise<{ data?: ClinicalDiagnosisCatalogHit[]; error?: string }> {
  const pattern = `%${query}%`;
  const prefix = `${query}%`;
  const { data, error } = await supabase
    .from("clinical_diagnoses")
    .select("id,name,normalized_name,snomed_code,cie10_code,cie11_code,category,synonyms")
    .eq("active", true)
    .or(
      `name.ilike.${pattern},normalized_name.ilike.${pattern},cie10_code.ilike.${prefix},cie10_code.ilike.${pattern}`
    )
    .order("name")
    .limit(limit);

  if (error) {
    console.error("[searchClinicalDiagnoses] direct query failed:", error.message, error.code);
    return { error: "No se pudo buscar en el catálogo de diagnósticos." };
  }

  const qLower = query.toLowerCase();
  const ranked = (data ?? [])
    .map((row) => {
      const name = row.name?.toLowerCase() ?? "";
      const code = row.cie10_code?.toLowerCase() ?? "";
      const synonyms = Array.isArray(row.synonyms) ? row.synonyms : [];
      let rank = 3;
      if (code === qLower || code.startsWith(qLower)) rank = 0;
      else if (name.startsWith(qLower)) rank = 1;
      else if (synonyms.some((s) => String(s).toLowerCase().includes(qLower))) rank = 2;
      return { row, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.row.name.localeCompare(b.row.name))
    .slice(0, limit)
    .map(({ row }) => row);

  return { data: mapDiagnosisRows(ranked as ClinicalDiagnosisCatalogHit[]) };
}

export async function searchClinicalDiagnoses(
  query: string,
  limit = 10
): Promise<{ data?: ClinicalDiagnosisCatalogHit[]; error?: string }> {
  const [user, active, supabase] = await Promise.all([
    getSession(),
    getActiveClinic(),
    createClient(),
  ]);
  if (!user) return { error: "Sesión requerida" };

  const { role, isSuperadmin } = active;
  if (!hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos para buscar diagnósticos" };
  }

  const queryParsed = searchQuerySchema.safeParse(query.trim());
  if (!queryParsed.success) return { data: [] };
  const boundedLimit = Math.min(Math.max(limit, 1), 25);
  const { data, error } = await supabase.rpc("search_clinical_diagnoses", {
    p_query: queryParsed.data,
    p_limit: boundedLimit,
  });

  if (error) {
    console.error(
      "[searchClinicalDiagnoses] RPC failed:",
      error.message,
      error.code,
      error.details
    );
    return searchClinicalDiagnosesDirect(supabase, queryParsed.data, boundedLimit);
  }

  return { data: mapDiagnosisRows((data ?? []) as ClinicalDiagnosisCatalogHit[]) };
}
