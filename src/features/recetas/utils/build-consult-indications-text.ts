import {
  buildIndicationsSnapshot,
  type ClinicalTreatmentEntry,
  mergeTreatmentsForPersist,
} from "@/features/historias/utils/clinical-structured-entries";
import { formatPrescriptionMedicationLabel } from "@/features/recetas/utils/format-prescription-medication-label";

import type { PrescriptionMedication } from "@/types/prescription";

/**
 * Snapshot imprimible de indicaciones/tratamientos para clinical_records.indications.
 * Separates plan terapéutico/conducta from medications.
 */
export function buildConsultIndicationsText(
  medications: PrescriptionMedication[],
  freeText: string,
  catalogTreatments: ClinicalTreatmentEntry[] = []
): string {
  const fromStructured = buildIndicationsSnapshot(
    mergeTreatmentsForPersist(catalogTreatments, medications),
    freeText
  );
  if (fromStructured.trim()) return fromStructured;

  const medLines = medications.map(formatPrescriptionMedicationLabel).filter(Boolean);
  const notes = freeText.trim();
  if (medLines.length === 0) return notes;
  if (!notes) return `Medicamento:\n${medLines.map((line) => `- ${line}`).join("\n")}`;
  return `Medicamento:\n${medLines.map((line) => `- ${line}`).join("\n")}\n\nNotas:\n${notes}`;
}
