/**
 * Organization context must come from authenticated server session.
 * A client-supplied clinic/organization id is accepted only when it matches.
 */
export function resolveTrustedClinicId(
  sessionClinicId: string | null | undefined,
  requestedClinicId?: string | null
): string | null {
  if (!sessionClinicId) return null;
  if (!requestedClinicId) return sessionClinicId;
  if (requestedClinicId !== sessionClinicId) return null;
  return sessionClinicId;
}
