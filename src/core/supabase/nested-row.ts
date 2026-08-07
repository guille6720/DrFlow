/** Unwraps PostgREST nested relation (object or single-element array). */
export function unwrapNestedRow<T extends Record<string, unknown>>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/** Reads profile full_name from a nested or flat profiles relation. */
export function nestedProfileFullName(
  profiles: { full_name?: string | null } | { full_name?: string | null }[] | null | undefined
): string | undefined {
  return unwrapNestedRow(profiles)?.full_name ?? undefined;
}
