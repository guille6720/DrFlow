import { extractPathologySearchQuery } from "@/lib/utils/clinical-assistant";
import { extractEvolutionDiagnosis } from "@/lib/utils/parse-evolution-medications";

/** Deriva término de búsqueda CIE-10 desde texto de evolución. */
export function resolveConsultationPathologyQuery(evolutionText: string): string {
  const fromEvolution = extractEvolutionDiagnosis(evolutionText);
  if (fromEvolution.length >= 3) return fromEvolution.slice(0, 80);
  return extractPathologySearchQuery({ lastEvolution: evolutionText });
}
