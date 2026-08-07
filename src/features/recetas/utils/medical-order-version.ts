/** Normaliza el token de optimistic lock (default 1 si falta en filas legacy). */
export function normalizeMedicalOrderVersion(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 1) return parsed;
  }
  return 1;
}

/** Returns null when the client did not send a version (legacy / stale page). */
export function parseMedicalOrderExpectedVersion(formData: FormData): number | null {
  const raw = String(formData.get("expected_version") ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}
