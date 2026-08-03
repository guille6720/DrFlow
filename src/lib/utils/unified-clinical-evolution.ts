/** Une campos legacy de consulta en un solo texto de evolución. */
export function buildUnifiedClinicalEvolution(fields: {
  chief_complaint?: string | null;
  diagnosis?: string | null;
  evolution?: string | null;
  indications?: string | null;
}): string {
  const chief = fields.chief_complaint?.trim() ?? "";
  const diagnosis = fields.diagnosis?.trim() ?? "";
  const evolution = fields.evolution?.trim() ?? "";
  const indications = fields.indications?.trim() ?? "";

  const hasLegacy = Boolean(chief || diagnosis || indications);
  if (!hasLegacy) return evolution;

  return [chief, diagnosis, evolution, indications].filter(Boolean).join("\n\n");
}
