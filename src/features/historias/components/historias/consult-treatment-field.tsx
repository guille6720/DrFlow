"use client";

import { MedicationAutocomplete } from "@/features/historias/components/historias/medication-autocomplete";

import type { PrescriptionMedication } from "@/types/prescription";

type Props = {
  medications: PrescriptionMedication[];
  onMedicationsChange: (medications: PrescriptionMedication[]) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
  highlighted?: boolean;
};

/** Campo de medicación en consulta (sin plan: el plan va en sección aparte). */
export function ConsultTreatmentField({
  medications,
  onMedicationsChange,
  searchInputRef,
  className,
  highlighted = false,
}: Props) {
  return (
    <MedicationAutocomplete
      medications={medications}
      onMedicationsChange={onMedicationsChange}
      searchInputRef={searchInputRef}
      className={className}
      highlighted={highlighted}
      label="Medicación"
      placeholder="Buscar medicamento…"
    />
  );
}
