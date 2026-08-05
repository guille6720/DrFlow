/** Unwrap PostgREST embedded relation (single object or one-element array). */
export function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}
