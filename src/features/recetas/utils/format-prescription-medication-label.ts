import type { PrescriptionMedication } from "@/types/prescription";

/** Etiqueta legible para chips y texto en evolución. */
export function formatPrescriptionMedicationLabel(med: PrescriptionMedication): string {
  const brand = med.brand_name?.trim();
  const presentation = med.presentation?.trim();
  if (brand && presentation) return `${brand} ${presentation}`;
  if (brand) return brand;
  return med.generic_name.trim();
}
