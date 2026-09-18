/** User-facing correlation reference derived from internal trace id (no PHI). */

export function formatUserReferenceId(traceId: string | undefined | null): string | null {
  if (!traceId || traceId.length < 6) return null;
  const compact = traceId.replace(/[^a-f0-9]/gi, "").slice(-6).toUpperCase();
  if (compact.length < 6) return null;
  return `DF-${compact}`;
}

export function userFacingErrorMessage(
  baseMessage: string,
  traceId?: string | null
): string {
  const ref = formatUserReferenceId(traceId);
  if (!ref) return baseMessage;
  return `${baseMessage} Referencia: ${ref}.`;
}
