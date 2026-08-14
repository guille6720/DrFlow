import { formatPrescriptionMedicationLabel } from "@/features/recetas/utils/format-prescription-medication-label";
import {
  buildIndicationsSnapshot,
  medicationsToTreatmentEntries,
} from "@/features/historias/utils/clinical-structured-entries";

import type { PrescriptionMedication } from "@/types/prescription";

/**
 * Snapshot imprimible de indicaciones/tratamientos para clinical_records.indications.
 * Phase 3: TEXT es solo lectura/impresión — las tablas EHR usan treatments_json / filas hijas.
 */
export function buildConsultIndicationsText(
  medications: PrescriptionMedication[],
  freeText: string
): string {
  const fromStructured = buildIndicationsSnapshot(
    medicationsToTreatmentEntries(medications),
    freeText
  );
  if (fromStructured.trim()) return fromStructured;

  // Sin fármacos estructurados: conservar notas libres o etiquetas legibles legacy.
  const medLines = medications.map(formatPrescriptionMedicationLabel).filter(Boolean);
  const notes = freeText.trim();
  if (medLines.length === 0) return notes;
  if (!notes) return medLines.map((line) => `- ${line}`).join("\n");
  return `Tratamiento:\n${medLines.map((line) => `- ${line}`).join("\n")}\n\nIndicaciones:\n${notes}`;
}
