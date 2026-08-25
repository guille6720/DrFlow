/**
 * Prescription category / subtype registry (Phase 2).
 * Centralized and replaceable — no invented national numeric codes.
 */

export const PRESCRIPTION_CATEGORIES = [
  "medication",
  "device",
  "complementary_study",
  "practice",
  "procedure",
] as const;

export type PrescriptionCategory = (typeof PRESCRIPTION_CATEGORIES)[number];

export const PRESCRIPTION_CATEGORY_LABELS: Record<PrescriptionCategory, string> = {
  medication: "Medicamento",
  device: "Dispositivo / producto médico",
  complementary_study: "Estudio complementario",
  practice: "Práctica",
  procedure: "Procedimiento",
};

/** Medication dispensing condition / subtype labels (replaceable mappings). */
export const MEDICATION_SUBTYPES = [
  "ambulatory",
  "chronic",
  "duplicated_controlled",
  "hospital",
] as const;

export type MedicationSubtype = (typeof MEDICATION_SUBTYPES)[number];

export const MEDICATION_SUBTYPE_LABELS: Record<MedicationSubtype, string> = {
  ambulatory: "Ambulatoria",
  chronic: "Tratamiento prolongado / crónica",
  duplicated_controlled: "Duplicado / psicotrópicos",
  hospital: "Institucional / hospitalaria",
};

export function isPrescriptionCategory(value: unknown): value is PrescriptionCategory {
  return (
    typeof value === "string" &&
    (PRESCRIPTION_CATEGORIES as readonly string[]).includes(value)
  );
}

export function mapLegacyPrescriptionTypeToCategory(
  type: string | null | undefined
): PrescriptionCategory {
  // Existing DrFlow types are medication-oriented.
  void type;
  return "medication";
}

export function mapLegacyPrescriptionTypeToSubtype(
  type: string | null | undefined
): MedicationSubtype {
  switch (type) {
    case "cronica":
      return "chronic";
    case "duplicado":
      return "duplicated_controlled";
    default:
      return "ambulatory";
  }
}
