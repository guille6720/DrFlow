import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pathologyDrugToPrescription } from "@/features/recetas/components/recetas/pathology-drug-to-prescription";
import { TREATMENT_LINE_LABELS } from "@/types/pharmacology";
import type { PathologyDrug } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";
import { Plus } from "lucide-react";

function resolveDrug(pd: PathologyDrug) {
  return Array.isArray(pd.drugs) ? pd.drugs[0] : pd.drugs;
}

interface Props {
  pathologyName: string;
  drugs: PathologyDrug[];
  existingGenericNames: string[];
  onAddMedications: (medications: PrescriptionMedication[]) => void;
}

export function PrescriptionDrugSuggestions({
  pathologyName,
  drugs,
  existingGenericNames,
  onAddMedications,
}: Props) {
  function addDrug(pd: PathologyDrug) {
    const med = pathologyDrugToPrescription(pd);
    if (!med) return;
    if (existingGenericNames.some((n) => n.toLowerCase() === med.generic_name.toLowerCase())) {
      return;
    }
    onAddMedications([med]);
  }

  function addFirstLine() {
    const firstLine = drugs.filter((d) => d.treatment_line === 1);
    const meds = firstLine
      .map(pathologyDrugToPrescription)
      .filter((m): m is PrescriptionMedication => m !== null)
      .filter(
        (m) => !existingGenericNames.some((n) => n.toLowerCase() === m.generic_name.toLowerCase())
      );
    if (meds.length > 0) onAddMedications(meds);
  }

  const grouped = drugs.reduce<Map<number, PathologyDrug[]>>((acc, pd) => {
    const line = pd.treatment_line;
    if (!acc.has(line)) acc.set(line, []);
    acc.get(line)!.push(pd);
    return acc;
  }, new Map());

  if (drugs.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500">Sin fármacos de referencia para esta patología.</p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">Fármacos sugeridos para {pathologyName}</p>
        <Button type="button" size="sm" variant="outline" onClick={addFirstLine}>
          <Plus className="h-3.5 w-3.5" />
          Agregar 1ª línea
        </Button>
      </div>

      {Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([line, lineDrugs]) => (
          <div key={line} className="rounded-lg border border-white bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">
              {TREATMENT_LINE_LABELS[line] ?? `Línea ${line}`}
            </p>
            <ul className="space-y-2">
              {lineDrugs.map((pd) => {
                const drug = resolveDrug(pd);
                if (!drug) return null;
                const med = pathologyDrugToPrescription(pd);
                const alreadyAdded = Boolean(
                  med &&
                    existingGenericNames.some(
                      (n) => n.toLowerCase() === med.generic_name.toLowerCase()
                    )
                );
                return (
                  <li
                    key={pd.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{drug.active_ingredient}</p>
                      <p className="text-xs text-slate-600">
                        {drug.name}
                        {drug.presentation ? ` · ${drug.presentation}` : ""}
                      </p>
                      {pd.dosage_reference && (
                        <p className="text-xs text-blue-700">{pd.dosage_reference}</p>
                      )}
                      <Badge variant="teal" className="mt-1 font-mono text-[10px]">
                        {drug.atc_code}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={alreadyAdded}
                      onClick={() => addDrug(pd)}
                    >
                      {alreadyAdded ? "Agregado" : "Agregar"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </div>
  );
}
