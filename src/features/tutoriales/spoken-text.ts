/** Normalize copy for speech synthesis (Argentine Spanish clinical UX). */
export function normalizeSpokenText(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/NexClinic/gi, "Nex Clinic")
    .replace(/\/turnos\/agenda/gi, "agenda de turnos")
    .replace(/\/turnos\/nuevo/gi, "nuevo turno")
    .trim();
}
