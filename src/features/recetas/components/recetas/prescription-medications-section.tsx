import { Plus, Trash2 } from "lucide-react";

import { appendPrescriptionMedication, emptyPrescriptionMedication } from "@/features/recetas/components/recetas/prescription-form-utils";
import {
  mergeVademecumIntoMedication,
  PrescriptionMedicationLineFields,
} from "@/features/recetas/components/recetas/prescription-medication-line-fields";
import { PrescriptionMedicationSearch } from "@/features/recetas/components/recetas/prescription-medication-search";

import { Button } from "@/components/ui/button";
import type { PamiVademecumResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

interface Props {
  medications: PrescriptionMedication[];
  setMedications: React.Dispatch<React.SetStateAction<PrescriptionMedication[]>>;
  updateMed: (index: number, field: keyof PrescriptionMedication, value: string | number | boolean) => void;
}

export function PrescriptionMedicationsSection({ medications, setMedications, updateMed }: Props) {
  const existingGenericNames = medications.map((m) => m.generic_name.trim()).filter(Boolean);

  function addMedicationFromSearch(med: PrescriptionMedication) {
    setMedications((prev) => appendPrescriptionMedication(prev, med));
  }

  function applyVademecum(index: number, item: PamiVademecumResult) {
    setMedications((prev) =>
      prev.map((med, i) => (i === index ? mergeVademecumIntoMedication(med, item) : med))
    );
  }

  return (
    <div className="space-y-4">
      <PrescriptionMedicationSearch
        onAdd={addMedicationFromSearch}
        existingGenericNames={existingGenericNames}
      />

      <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">Medicamentos en la receta</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMedications((m) => [...m, emptyPrescriptionMedication()])}
        >
          <Plus className="h-4 w-4" />
          Agregar manual
        </Button>
      </div>

      {medications.map((med, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Medicamento {index + 1}</span>
            {medications.length > 1 && (
              <button
                type="button"
                onClick={() => setMedications((m) => m.filter((_, i) => i !== index))}
                className="text-red-600 hover:text-red-800"
                aria-label="Quitar medicamento"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <PrescriptionMedicationLineFields
            med={med}
            index={index}
            updateMed={updateMed}
            applyVademecum={applyVademecum}
          />
        </div>
      ))}
      </div>
    </div>
  );
}
