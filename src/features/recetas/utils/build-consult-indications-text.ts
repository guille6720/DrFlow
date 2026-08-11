import { formatPrescriptionMedicationLabel } from "@/features/recetas/utils/format-prescription-medication-label";

import type { PrescriptionMedication } from "@/types/prescription";

/** Combina fármacos del vademécum con indicaciones libres para guardar en HC. */
export function buildConsultIndicationsText(
  medications: PrescriptionMedication[],
  freeText: string
): string {
  const medLines = medications.map(formatPrescriptionMedicationLabel).filter(Boolean);
  const notes = freeText.trim();
  if (medLines.length === 0) return notes;
  if (!notes) return medLines.join("\n");
  return `${medLines.join("\n")}\n\n${notes}`;
}
