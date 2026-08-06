export function buildPacientesSearchUrl(q: string, cobertura?: string, patologia?: string): string {
  const params = new URLSearchParams();
  const trimmedQ = q.trim();
  const trimmedPat = patologia?.trim();
  if (trimmedQ) params.set("q", trimmedQ);
  if (trimmedPat) params.set("patologia", trimmedPat);
  if (cobertura === "pami") params.set("cobertura", "pami");
  const qs = params.toString();
  if (qs) return `/pacientes?${qs}`;
  return cobertura === "pami" ? "/pacientes?cobertura=pami" : "/pacientes";
}

export function buildPacientesPageQuery(
  page: number,
  q: string,
  cobertura?: string,
  patologia?: string
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (q) params.set("q", q);
  if (patologia) params.set("patologia", patologia);
  if (cobertura === "pami") params.set("cobertura", "pami");
  return `/pacientes?${params.toString()}`;
}

export function resolvePacientesClearHref(
  q: string,
  cobertura?: string,
  patologia?: string
): string | undefined {
  if (!q && !patologia && cobertura !== "pami") return undefined;
  return cobertura === "pami" ? "/pacientes?cobertura=pami" : "/pacientes";
}
