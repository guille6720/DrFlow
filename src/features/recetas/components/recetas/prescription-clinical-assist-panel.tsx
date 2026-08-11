"use client";

import { PamiPatientBanner } from "@/features/pacientes/components/pacientes/pami-patient-banner";
import type { PatientEhrTreatmentRow } from "@/features/pacientes/utils/patient-ehr-model";
import { PrescriptionAllergyBanner } from "@/features/recetas/components/recetas/prescription-allergy-banner";
import { PrescriptionDrugSuggestions } from "@/features/recetas/components/recetas/prescription-drug-suggestions";
import { PrescriptionHceTreatmentsPanel } from "@/features/recetas/components/recetas/prescription-hce-treatments-panel";
import { usePrescriptionDiagnosisHints } from "@/features/recetas/hooks/use-prescription-diagnosis-hints";
import type { PrescriptionWizardPatient } from "@/features/recetas/hooks/use-prescription-wizard";

import { Button } from "@/components/ui/button";
import { isPamiCoverage } from "@/lib/constants/coverages";
import type { PrescriptionMedication } from "@/types/prescription";

type Props = {
  patient?: PrescriptionWizardPatient | null;
  allergiesText?: string | null;
  diagnosisText: string;
  evolutionIndications?: string | null;
  notes: string;
  onNotesChange: (value: string) => void;
  medications: PrescriptionMedication[];
  onAddMedications: (medications: PrescriptionMedication[]) => void;
  hceTreatments: PatientEhrTreatmentRow[];
};

export function PrescriptionClinicalAssistPanel({
  patient,
  allergiesText,
  diagnosisText,
  evolutionIndications,
  notes,
  onNotesChange,
  medications,
  onAddMedications,
  hceTreatments,
}: Props) {
  const { pathologyName, drugs, loading, hasHints } = usePrescriptionDiagnosisHints({
    diagnosisText,
  });

  const existingGenericNames = medications.map((m) => m.generic_name.trim()).filter(Boolean);
  const showEvolutionIndications =
    Boolean(evolutionIndications?.trim()) &&
    !notes.trim().toLowerCase().includes(evolutionIndications!.trim().slice(0, 24).toLowerCase());

  return (
    <div className="space-y-4">
      {patient && isPamiCoverage(patient.insurance_provider) ? (
        <PamiPatientBanner patient={patient} />
      ) : null}

      <PrescriptionAllergyBanner allergiesText={allergiesText} medications={medications} />

      {showEvolutionIndications ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3 text-sm">
          <p className="font-medium text-teal-900">Indicaciones en la evolución actual</p>
          <p className="mt-1 whitespace-pre-wrap text-teal-950/90">{evolutionIndications}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => onNotesChange(evolutionIndications!.trim())}
          >
            Usar indicaciones de evolución
          </Button>
        </div>
      ) : null}

      <PrescriptionHceTreatmentsPanel
        treatments={hceTreatments}
        onApplyMedications={onAddMedications}
        existingGenericNames={existingGenericNames}
      />

      {diagnosisText.trim().length >= 3 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">
            Medicamentos relacionados con el diagnóstico
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Ayuda para la selección. El profesional debe elegir y confirmar cada medicamento.
          </p>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Buscando en vademécum…</p>
          ) : hasHints && pathologyName ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {pathologyName}
              </p>
              <PrescriptionDrugSuggestions
                pathologyName={pathologyName}
                drugs={drugs}
                existingGenericNames={existingGenericNames}
                onAddMedications={onAddMedications}
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Sin sugerencias automáticas para este diagnóstico.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
