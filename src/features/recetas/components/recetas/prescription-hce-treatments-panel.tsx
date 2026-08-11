"use client";

import { useState } from "react";

import type { PatientEhrTreatmentRow } from "@/features/pacientes/utils/patient-ehr-model";
import {
  emptyPrescriptionMedication,
} from "@/features/recetas/components/recetas/prescription-form-utils";

import { Button } from "@/components/ui/button";
import type { PrescriptionMedication } from "@/types/prescription";

type Props = {
  treatments: PatientEhrTreatmentRow[];
  onApplyMedications: (medications: PrescriptionMedication[]) => void;
  existingGenericNames: string[];
  embedded?: boolean;
};

function treatmentToMedication(row: PatientEhrTreatmentRow): PrescriptionMedication {
  const base = emptyPrescriptionMedication();
  return {
    ...base,
    generic_name: row.product,
    posology: [row.dose, row.frequency].filter((x) => x && x !== "—").join(" — ") || base.posology,
    instructions: row.notes || undefined,
  };
}

export function PrescriptionHceTreatmentsPanel({
  treatments,
  onApplyMedications,
  existingGenericNames,
  embedded = false,
}: Props) {
  const [show, setShow] = useState(false);

  if (treatments.length === 0) return null;

  const visible = embedded || show;

  const recent = treatments.slice(0, 12);

  function handleUseAsBase(row: PatientEhrTreatmentRow) {
    const med = treatmentToMedication(row);
    if (
      existingGenericNames.some((n) => n.toLowerCase() === med.generic_name.toLowerCase())
    ) {
      return;
    }
    onApplyMedications([med]);
  }

  return (
    <div className={embedded ? "" : "rounded-xl border border-slate-200 bg-slate-50/80 p-3"}>
      {!embedded ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />
          Mostrar tratamientos de la HCE
        </label>
      ) : null}

      {visible ? (
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
          {recent.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{row.product}</p>
                <p className="text-xs text-slate-600">
                  {row.dateLabel}
                  {row.dose && row.dose !== "—" ? ` · ${row.dose}` : ""}
                  {row.frequency && row.frequency !== "—" ? ` · ${row.frequency}` : ""}
                </p>
                {row.status ? (
                  <p className="text-xs text-slate-500">Estado: {row.status}</p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleUseAsBase(row)}
              >
                Usar como base
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
