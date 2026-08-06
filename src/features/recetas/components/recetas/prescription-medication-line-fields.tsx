"use client";

import { PrescriptionMedicationVademecumTypeahead } from "@/features/recetas/components/recetas/prescription-medication-vademecum-typeahead";
import { vademecumToPrescription } from "@/features/recetas/components/recetas/vademecum-to-prescription";

import { Input } from "@/components/ui/input";
import type { PamiVademecumResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

type Props = {
  med: PrescriptionMedication;
  index: number;
  updateMed: (index: number, field: keyof PrescriptionMedication, value: string | number | boolean) => void;
  applyVademecum: (index: number, item: PamiVademecumResult) => void;
};

export function PrescriptionMedicationLineFields({ med, index, updateMed, applyVademecum }: Props) {
  function handleVademecumSelect(item: PamiVademecumResult) {
    applyVademecum(index, item);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PrescriptionMedicationVademecumTypeahead
        label="Nombre genérico *"
        required
        value={med.generic_name}
        onChange={(value) => updateMed(index, "generic_name", value)}
        onSelect={handleVademecumSelect}
        placeholder="Ej: ibuprofeno, enalapril…"
      />
      <PrescriptionMedicationVademecumTypeahead
        label="Marca (opcional)"
        value={med.brand_name ?? ""}
        onChange={(value) => updateMed(index, "brand_name", value)}
        onSelect={handleVademecumSelect}
        placeholder="Ej: Ibupirac, Lotrial…"
      />
      <Input
        label="Presentación"
        value={med.presentation ?? ""}
        onChange={(e) => updateMed(index, "presentation", e.target.value)}
        placeholder="Ej: comp x 30"
      />
      <Input
        label="Concentración"
        value={med.concentration ?? ""}
        onChange={(e) => updateMed(index, "concentration", e.target.value)}
        placeholder="Ej: 10 mg"
      />
      <Input
        label="Cantidad"
        type="number"
        min={1}
        value={med.quantity}
        onChange={(e) => updateMed(index, "quantity", Number(e.target.value))}
      />
      <Input
        label="Vía"
        value={med.route ?? ""}
        onChange={(e) => updateMed(index, "route", e.target.value)}
        placeholder="oral, tópica..."
      />
      <div className="sm:col-span-2">
        <Input
          label="Posología *"
          required
          value={med.posology}
          onChange={(e) => updateMed(index, "posology", e.target.value)}
          placeholder="Ej: 1 comp cada 12 hs por 7 días"
        />
      </div>
    </div>
  );
}

export function mergeVademecumIntoMedication(
  current: PrescriptionMedication,
  item: PamiVademecumResult
): PrescriptionMedication {
  const mapped = vademecumToPrescription(item);
  return {
    ...current,
    generic_name: mapped.generic_name,
    brand_name: mapped.brand_name,
    presentation: mapped.presentation,
    concentration: mapped.concentration,
    route: mapped.route ?? current.route,
    quantity: current.quantity || mapped.quantity,
    posology: current.posology || mapped.posology,
  };
}
