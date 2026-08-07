import type { MedicationCard } from "@/features/pacientes/utils/patient-chart-model-types";

import type { PrescriptionMedication } from "@/types/prescription";

/** Minimal prescription medication for rule-based safety checks (name-only context). */
export function stubPrescriptionMedication(genericName: string): PrescriptionMedication {
  return {
    generic_name: genericName,
    quantity: 1,
    posology: "—",
  };
}

/** Builds a medication card when only the drug name is known (proposed Rx / tests). */
export function stubMedicationCard(
  input: Pick<MedicationCard, "id" | "name"> &
    Partial<Pick<MedicationCard, "dose" | "frequency" | "sinceLabel" | "lastRenewalLabel">>
): MedicationCard {
  return {
    dose: input.dose ?? "—",
    frequency: input.frequency ?? "—",
    sinceLabel: input.sinceLabel ?? "—",
    lastRenewalLabel: input.lastRenewalLabel ?? "—",
    raw: stubPrescriptionMedication(input.name),
    id: input.id,
    name: input.name,
  };
}
