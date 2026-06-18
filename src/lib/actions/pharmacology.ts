"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveClinic, getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import type {
  PathologyBySymptomResult,
  PathologyDrug,
  PathologySearchResult,
  SymptomSearchResult,
} from "@/types/pharmacology";

const MIN_QUERY_LENGTH = 2;

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

  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { data: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_pathologies", {
    p_query: trimmed,
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

  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { data: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_symptoms", {
    p_query: trimmed,
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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_pathologies_by_symptoms", {
    p_symptom_ids: symptomIds,
    p_limit: 12,
  });

  if (error) {
    return { error: "No se pudieron sugerir patologías para esos síntomas." };
  }

  return { data: (data ?? []) as PathologyBySymptomResult[] };
}

export async function getDrugsByPathology(
  pathologyId: string
): Promise<{ data?: PathologyDrug[]; error?: string }> {
  const access = await assertPharmacologyAccess();
  if (access.error) return access;

  if (!pathologyId) return { error: "Patología no seleccionada" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pathology_drugs")
    .select(
      "id, pathology_id, drug_id, treatment_line, priority, indication_notes, dosage_reference, drugs(id, name, active_ingredient, atc_code, atc_description, presentation, route)"
    )
    .eq("pathology_id", pathologyId)
    .eq("is_active", true)
    .order("treatment_line")
    .order("priority");

  if (error) {
    return { error: "No se pudieron cargar los fármacos asociados." };
  }

  return { data: (data ?? []) as unknown as PathologyDrug[] };
}
