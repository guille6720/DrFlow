import type { SupabaseClient } from "@supabase/supabase-js";

/** Normaliza término de búsqueda de pacientes (nombre, apellido, DNI). */
export function sanitizePatientSearchTerm(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

/** Normaliza búsqueda por patología / diagnóstico en historias clínicas. */
export function sanitizePatientPathologySearchTerm(raw: string | undefined): string {
  return sanitizePatientSearchTerm(raw);
}

/** Escapa caracteres especiales en filtros PostgREST `.or()`. */
function escapePostgrestFilterValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\*/g, "\\*")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/** Patrón ILIKE para `.or()` — PostgREST usa `*` en lugar de `%` para evitar errores de encoding. */
export function buildPostgrestIlikePattern(token: string): string {
  return `*${escapePostgrestFilterValue(token)}*`;
}

/** Prefijo de apellido: una letra → apellidos que empiezan con esa letra (ILIKE, sin distinguir mayúsculas). */
export function buildPostgrestLastNamePrefixPattern(letter: string): string {
  return `${escapePostgrestFilterValue(letter)}*`;
}

export function isSingleLetterSearch(q: string): boolean {
  const trimmed = q.trim();
  return trimmed.length === 1 && /^\p{L}$/u.test(trimmed);
}

export function patientSearchTokens(q: string): string[] {
  return q.split(/\s+/).map((part) => part.trim()).filter(Boolean);
}

type PatientSearchQuery = {
  or: (filters: string) => PatientSearchQuery;
};

function buildPatientFieldOrFilter(token: string): string {
  const pattern = buildPostgrestIlikePattern(token);
  return [
    `first_name.ilike.${pattern}`,
    `last_name.ilike.${pattern}`,
    `document_number.ilike.${pattern}`,
    `phone.ilike.${pattern}`,
  ].join(",");
}

function buildLastNamePrefixFilter(letter: string): string {
  return `last_name.ilike.${buildPostgrestLastNamePrefixPattern(letter)}`;
}

/** Aplica búsqueda por tokens: cada palabra debe coincidir en nombre, apellido o DNI. */
export function applyPatientSearchFilter<T extends PatientSearchQuery>(query: T, q: string): T {
  const trimmed = q.trim();
  if (!trimmed) return query;

  if (isSingleLetterSearch(trimmed)) {
    return query.or(buildLastNamePrefixFilter(trimmed)) as T;
  }

  const tokens = patientSearchTokens(q);
  if (tokens.length === 0) return query;

  let next = query;
  for (const token of tokens) {
    next = next.or(buildPatientFieldOrFilter(token)) as T;
  }
  return next;
}

function buildClinicalPathologyOrFilter(token: string): string {
  const pattern = buildPostgrestIlikePattern(token);
  return [`diagnosis.ilike.${pattern}`, `chief_complaint.ilike.${pattern}`].join(",");
}

type PathologySearchClient = Pick<SupabaseClient, "from">;

type PathologyRpcClient = PathologySearchClient & {
  rpc: (
    fn: "search_patient_ids_by_pathology",
    args: { p_clinic_id: string; p_query: string }
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** Resuelve IDs de pacientes con diagnóstico o motivo de consulta que coincidan (AND entre tokens). */
export async function findPatientIdsByPathologySearch(
  supabase: PathologySearchClient,
  clinicId: string,
  pathologyQ: string
): Promise<{ patientIds: string[]; error?: string }> {
  const tokens = patientSearchTokens(pathologyQ);
  if (tokens.length === 0) return { patientIds: [] };

  const rpcClient = supabase as PathologyRpcClient;
  const { data: rpcData, error: rpcError } = await rpcClient.rpc("search_patient_ids_by_pathology", {
    p_clinic_id: clinicId,
    p_query: pathologyQ,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return { patientIds: rpcData.filter((id): id is string => typeof id === "string") };
  }

  let matchedIds: string[] | null = null;

  for (const token of tokens) {
    const { data, error } = await supabase
      .from("clinical_records")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .or(buildClinicalPathologyOrFilter(token));

    if (error) {
      return { patientIds: [], error: "No se pudo buscar por patología" };
    }

    const tokenIds: string[] = [];
    for (const row of data ?? []) {
      if (typeof row.patient_id === "string") tokenIds.push(row.patient_id);
    }
    if (tokenIds.length === 0) return { patientIds: [] };

    if (matchedIds === null) {
      matchedIds = tokenIds;
    } else {
      const allowed = new Set(tokenIds);
      matchedIds = matchedIds.filter((id) => allowed.has(id));
    }
  }

  return { patientIds: matchedIds ?? [] };
}
