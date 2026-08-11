"use client";

import { AlertTriangle } from "lucide-react";

import { buildMedicationSafetyWarnings } from "@/lib/utils/clinical-assistant";
import type { PrescriptionMedication } from "@/types/prescription";

type Props = {
  allergiesText?: string | null;
  medications: PrescriptionMedication[];
};

function parseAllergies(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function PrescriptionAllergyBanner({ allergiesText, medications }: Props) {
  const allergies = parseAllergies(allergiesText);
  const medNames = medications.map((m) => m.generic_name.trim()).filter(Boolean);

  const warnings =
    allergies.length > 0 || medNames.length > 0
      ? buildMedicationSafetyWarnings({
          allergies,
          medications: [],
          extraMedNames: medNames,
        })
      : [];

  if (allergies.length === 0 && warnings.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          {allergies.length > 0 ? (
            <div>
              <p className="font-semibold uppercase tracking-wide">Alergias registradas</p>
              <ul className="mt-1 list-disc pl-5">
                {allergies.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-amber-800">
            Verificá interacciones y contraindicaciones antes de emitir. La decisión clínica es del
            profesional.
          </p>
        </div>
      </div>
    </div>
  );
}
