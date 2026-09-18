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

export type PacientesPageSection = "pacientes" | "historias";

export function parsePacientesPageSection(value: string | null | undefined): PacientesPageSection {
  return value === "historias" ? "historias" : "pacientes";
}

export function buildPacientesHistoriasUrl(params?: {
  q?: string;
  page?: number;
  cursor?: string | null;
  before?: string | null;
}): string {
  const search = new URLSearchParams();
  search.set("seccion", "historias");
  if (params?.q) search.set("q", params.q);
  if (params?.page && params.page > 1) search.set("page", String(params.page));
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.before) search.set("before", params.before);
  return `/pacientes?${search.toString()}`;
}
