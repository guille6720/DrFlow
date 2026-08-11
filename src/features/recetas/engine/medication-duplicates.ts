import type { ValidationIssue } from "@/features/recetas/engine/types";

import type { PrescriptionMedication } from "@/types/prescription";

function medicationKey(med: PrescriptionMedication): string {
  return [
    med.generic_name.trim().toLowerCase(),
    (med.concentration ?? "").trim().toLowerCase(),
    (med.presentation ?? "").trim().toLowerCase(),
  ].join("|");
}

export function findDuplicateMedications(medications: PrescriptionMedication[]): ValidationIssue[] {
  const seen = new Map<string, number>();
  const issues: ValidationIssue[] = [];

  medications.forEach((med, index) => {
    const key = medicationKey(med);
    if (!med.generic_name.trim()) return;
    const firstIndex = seen.get(key);
    if (firstIndex != null) {
      issues.push({
        severity: "error",
        code: "duplicate_medication",
        field: `medications.${index}.generic_name`,
        message: `Medicamento duplicado: "${med.generic_name}" (ya está en la línea ${firstIndex + 1}).`,
      });
    } else {
      seen.set(key, index);
    }
  });

  return issues;
}
