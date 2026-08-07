/** Parse free-text patient search into form prefill fields. */
export function parsePatientSearchQueryForPrefill(q: string): {
  first_name?: string;
  last_name?: string;
  document_number?: string;
} {
  const trimmed = q.trim();
  if (!trimmed) return {};

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (/^\d[\d.\-\s]*$/.test(trimmed) && digitsOnly.length >= 6) {
    return { document_number: digitsOnly };
  }

  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",");
    const first = rest.join(",").trim();
    return {
      last_name: last.trim(),
      ...(first ? { first_name: first } : {}),
    };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { last_name: parts[0] };
  }

  return {
    last_name: parts[0],
    first_name: parts.slice(1).join(" "),
  };
}

export function buildCreatePatientHref(query: string, returnPath: string): string {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set("q", trimmed);
  if (returnPath) params.set("return", returnPath);
  const qs = params.toString();
  return qs ? `/pacientes/nuevo?${qs}` : "/pacientes/nuevo";
}
