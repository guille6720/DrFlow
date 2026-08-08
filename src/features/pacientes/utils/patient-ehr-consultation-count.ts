import { buildConsultationSidebarList } from "@/features/historias/components/historias/patient-ehr-utils";
import { buildEhrPayloadFromHceRows } from "@/features/pacientes/utils/patient-ehr-from-hce";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

import type { HceExportRow } from "@/lib/utils/hce-export-parse";

function buildEvolutionList(sorted: PatientEhrConsultation[]): PatientEhrConsultation[] {
  const withText = sorted.filter(
    (c) =>
      c.category === "evolution" ||
      c.category === "document" ||
      (c.evolution?.trim().length ?? 0) > 15 ||
      (c.category !== "vitals" &&
        c.category !== "treatment" &&
        c.category !== "diagnostic" &&
        (c.chief_complaint?.trim().length ?? 0) > 20)
  );
  return withText.length > 0 ? withText : sorted.filter((c) => c.category === "evolution");
}

/** Cantidad de consultas = días de evolución visibles en el sidebar de la HC. */
export function countEhrConsultations(consultations: PatientEhrConsultation[]): number {
  if (consultations.length === 0) return 0;

  const sorted = [...consultations].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const evolutionList = buildEvolutionList(sorted);
  return buildConsultationSidebarList(sorted, evolutionList).length;
}

export function countConsultationsFromHceRows(
  rows: HceExportRow[],
  professionalFallback = "Profesional"
): number {
  if (rows.length === 0) return 0;
  const { consultations } = buildEhrPayloadFromHceRows(rows, professionalFallback);
  return countEhrConsultations(consultations);
}
