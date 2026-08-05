import { Plus, Trash2 } from "lucide-react";

import { emptyPrescriptionMedication } from "@/features/recetas/components/recetas/prescription-form-utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PrescriptionMedication } from "@/types/prescription";

interface Props {
  medications: PrescriptionMedication[];
  setMedications: React.Dispatch<React.SetStateAction<PrescriptionMedication[]>>;
  updateMed: (index: number, field: keyof PrescriptionMedication, value: string | number | boolean) => void;
}

export function PrescriptionMedicationsSection({ medications, setMedications, updateMed }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">Medicamentos (nombre genérico — Ley 25.649)</h4>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Nombre genérico *"
              required
              value={med.generic_name}
              onChange={(e) => updateMed(index, "generic_name", e.target.value)}
              placeholder="Ej: Enalapril"
            />
            <Input
              label="Marca (opcional)"
              value={med.brand_name ?? ""}
              onChange={(e) => updateMed(index, "brand_name", e.target.value)}
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
        </div>
      ))}
    </div>
  );
}
