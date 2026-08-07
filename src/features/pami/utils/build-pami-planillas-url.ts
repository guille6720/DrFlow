export function buildPamiPlanillasUrl(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/pami/planillas?${s}` : "/pami/planillas";
}
