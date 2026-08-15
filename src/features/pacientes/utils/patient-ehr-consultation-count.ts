import { buildConsultationSidebarList } from "@/features/historias/components/historias/patient-ehr-utils";
import type { PatientEhrMappedRecord } from "@/features/pacientes/server/load-patient-ehr-data";
import {
  buildEhrPayloadFromHceRows,
  mergeEhrPayload,
} from "@/features/pacientes/utils/patient-ehr-from-hce";
import {
  buildEhrPayloadFromRecords,
  type PatientEhrConsultation,
} from "@/features/pacientes/utils/patient-ehr-model";

import { filterRecordsForEhrSupplement, type HceExportRow } from "@/lib/utils/hce-export-parse";

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
  if (withText.length > 0) return withText;
  const evolutions = sorted.filter((c) => c.category === "evolution");
  return evolutions.length > 0 ? evolutions : sorted;
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

/** Misma lógica de conteo que la HC (BD + resumen HCE importado). */
export function countPatientConsultationsFromSources(input: {
  mappedRecords: PatientEhrMappedRecord[];
  hceRows: HceExportRow[] | null;
}): number {
  const { mappedRecords, hceRows } = input;

  if (hceRows?.length) {
    const professionalFallback =
      mappedRecords.find((record) => record.professional_name !== "Profesional")
        ?.professional_name ?? "Importación HCE";
    const fromHce = buildEhrPayloadFromHceRows(hceRows, professionalFallback);
    const supplement = buildEhrPayloadFromRecords(
      filterRecordsForEhrSupplement(mappedRecords)
    );
    return countEhrConsultations(mergeEhrPayload(fromHce, supplement).consultations);
  }

  return countEhrConsultations(buildEhrPayloadFromRecords(mappedRecords).consultations);
}
