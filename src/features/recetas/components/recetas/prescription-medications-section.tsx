import { Plus, Trash2 } from "lucide-react";

import {
  appendPrescriptionMedication,
  emptyPrescriptionMedication,
} from "@/features/recetas/components/recetas/prescription-form-utils";
import {
  mergeVademecumIntoMedication,
  PrescriptionMedicationLineFields,
} from "@/features/recetas/components/recetas/prescription-medication-line-fields";
import { PrescriptionMedicationSearch } from "@/features/recetas/components/recetas/prescription-medication-search";
import { PrescriptionPharmacologyPicker } from "@/features/recetas/components/recetas/prescription-pharmacology-picker";
import type { MedicationSearchSource } from "@/features/recetas/engine/types";
import {
  medicationCatalogCodeLabel,
  usesMedicationCatalogSearch,
} from "@/features/recetas/utils/medication-catalog-utils";

import { Button } from "@/components/ui/button";
import type { MedicationCatalogResult, PathologySearchResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

interface Props {
  medications: PrescriptionMedication[];
  setMedications: React.Dispatch<React.SetStateAction<PrescriptionMedication[]>>;
  updateMed: (index: number, field: keyof PrescriptionMedication, value: string | number | boolean) => void;
  medicationSearch?: MedicationSearchSource;
  onPathologySelect?: (pathology: PathologySearchResult) => void;
}

export function PrescriptionMedicationsSection({
  medications,
  setMedications,
  updateMed,
  medicationSearch = "medication_catalog",
  onPathologySelect,
}: Props) {
  const existingGenericNames = medications.map((m) => m.generic_name.trim()).filter(Boolean);

  function addMedicationFromSearch(med: PrescriptionMedication) {
    setMedications((prev) => appendPrescriptionMedication(prev, med));
  }

  function addMedicationsFromPharmacology(meds: PrescriptionMedication[]) {
    setMedications((prev) =>
      meds.reduce((acc, med) => appendPrescriptionMedication(acc, med), prev)
    );
  }

  function applyVademecum(index: number, item: MedicationCatalogResult) {
    setMedications((prev) =>
      prev.map((med, i) => (i === index ? mergeVademecumIntoMedication(med, item) : med))
    );
  }

  return (
    <div className="space-y-4">
      {usesMedicationCatalogSearch(medicationSearch) ? (
        <PrescriptionMedicationSearch
          onAdd={addMedicationFromSearch}
          existingGenericNames={existingGenericNames}
        />
      ) : null}

      {medicationSearch === "pharmacology" && onPathologySelect ? (
        <PrescriptionPharmacologyPicker
          onPathologySelect={onPathologySelect}
          onAddMedications={addMedicationsFromPharmacology}
          existingGenericNames={existingGenericNames}
        />
      ) : null}

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
              medicationSearch={medicationSearch}
              updateMed={updateMed}
              applyVademecum={applyVademecum}
            />
            {med.vademecum_code ? (
              <p className="mt-2 text-xs text-slate-500">
                {medicationCatalogCodeLabel("alfabeta")}: {med.vademecum_code}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
