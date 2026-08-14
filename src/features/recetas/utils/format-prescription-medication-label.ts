import type { PrescriptionMedication } from "@/types/prescription";

/** Etiqueta legible para chips y texto en evolución. */
export function formatPrescriptionMedicationLabel(med: PrescriptionMedication): string {
  const brand = med.brand_name?.trim();
  const presentation = med.presentation?.trim();
  const base =
    brand && presentation ? `${brand} ${presentation}` : brand || med.generic_name.trim();
  const dose = med.dose?.trim() || med.concentration?.trim();
  const frequency = med.frequency?.trim() || med.posology?.trim();
  return [base, dose, frequency].filter(Boolean).join(" · ");
}
