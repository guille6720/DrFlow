/** Normaliza término de búsqueda de pacientes (nombre, apellido, DNI). */
export function sanitizePatientSearchTerm(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

/** Escapa caracteres especiales en filtros PostgREST `.or()`. */
function escapePostgrestFilterValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export function patientSearchTokens(q: string): string[] {
  return q.split(/\s+/).map((part) => part.trim()).filter(Boolean);
}

type PatientSearchQuery = {
  or: (filters: string) => PatientSearchQuery;
};

/** Aplica búsqueda por tokens: cada palabra debe coincidir en nombre, apellido o DNI. */
export function applyPatientSearchFilter<T extends PatientSearchQuery>(query: T, q: string): T {
  const tokens = patientSearchTokens(q);
  if (tokens.length === 0) return query;

  let next = query;
  for (const token of tokens) {
    const escaped = escapePostgrestFilterValue(token);
    next = next.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,document_number.ilike.%${escaped}%`
    ) as T;
  }
  return next;
}
