"use server";

import { getActiveClinic, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { searchQuerySchema } from "@/core/validations/params";

import type { ClinicalDiagnosisCatalogHit } from "@/features/historias/types/clinical-diagnosis-catalog";

const SELECT_FIELDS =
  "id,name,normalized_name,snomed_code,cie10_code,cie11_code,category,synonyms";

function mapDiagnosisRows(rows: ClinicalDiagnosisCatalogHit[]): ClinicalDiagnosisCatalogHit[] {
  return rows.map((row) => ({
    ...row,
    synonyms: Array.isArray(row.synonyms) ? row.synonyms : [],
  }));
}

function rankDiagnosisHits(
  rows: ClinicalDiagnosisCatalogHit[],
  query: string,
  limit: number
): ClinicalDiagnosisCatalogHit[] {
  const qLower = query.toLowerCase();
  return rows
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
}

/** Fallback when RPC EXECUTE is missing but RLS SELECT on clinical_diagnoses works. */
async function searchClinicalDiagnosesDirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
  limit: number
): Promise<{ data?: ClinicalDiagnosisCatalogHit[]; error?: string }> {
  const pattern = `%${query}%`;
  const codePrefix = `${query}%`;

  const [byName, byCode, byNormalized] = await Promise.all([
    supabase
      .from("clinical_diagnoses")
      .select(SELECT_FIELDS)
      .eq("active", true)
      .ilike("name", pattern)
      .limit(limit),
    supabase
      .from("clinical_diagnoses")
      .select(SELECT_FIELDS)
      .eq("active", true)
      .ilike("cie10_code", codePrefix)
      .limit(limit),
    supabase
      .from("clinical_diagnoses")
      .select(SELECT_FIELDS)
      .eq("active", true)
      .ilike("normalized_name", pattern)
      .limit(limit),
  ]);

  const firstError = byName.error ?? byCode.error ?? byNormalized.error;
  if (firstError) {
    console.error(
      "[searchClinicalDiagnoses] direct query failed:",
      firstError.message,
      firstError.code
    );
    return { error: "No se pudo buscar en el catálogo de diagnósticos." };
  }

  const merged = new Map<string, ClinicalDiagnosisCatalogHit>();
  for (const row of [...(byName.data ?? []), ...(byCode.data ?? []), ...(byNormalized.data ?? [])]) {
    merged.set(row.id, row as ClinicalDiagnosisCatalogHit);
  }

  return {
    data: mapDiagnosisRows(rankDiagnosisHits([...merged.values()], query, limit)),
  };
}

export async function searchClinicalDiagnoses(
  query: string,
  limit = 10
): Promise<{ data?: ClinicalDiagnosisCatalogHit[]; error?: string }> {
  try {
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
  } catch (err) {
    console.error("[searchClinicalDiagnoses] unexpected error:", err);
    return { error: "No se pudo buscar en el catálogo de diagnósticos." };
  }
}
