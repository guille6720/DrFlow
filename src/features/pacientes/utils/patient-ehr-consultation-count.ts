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

import type { HceExportRow } from "@/lib/utils/hce-export-parse";

function buildEvolutionList(sorted: PatientEhrConsultation[]): PatientEhrConsultation[] {
  // Misma regla que la HC: contar/mostrar todos los registros, no solo evoluciones.
  return sorted;
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
    const fromRecords = buildEhrPayloadFromRecords(mappedRecords, {
      includeHceStructural: true,
    });
    return countEhrConsultations(mergeEhrPayload(fromHce, fromRecords).consultations);
  }

  return countEhrConsultations(
    buildEhrPayloadFromRecords(mappedRecords, { includeHceStructural: true }).consultations
  );
}
