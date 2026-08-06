/** Pick default prescriber: explicit override → clinic admin → first active professional. */
export function pickDefaultProfessionalId(
  adminProfessionalId: string | undefined,
  professionals: Array<{ id: string }>,
  override?: string | null
): string | undefined {
  const trimmed = override?.trim();
  if (trimmed && professionals.some((p) => p.id === trimmed)) {
    return trimmed;
  }
  if (adminProfessionalId && professionals.some((p) => p.id === adminProfessionalId)) {
    return adminProfessionalId;
  }
  return professionals[0]?.id;
}
