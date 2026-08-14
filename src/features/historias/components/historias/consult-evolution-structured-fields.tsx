"use client";

import { ClinicalFavoritesProvider } from "@/features/historias/components/historias/clinical-favorites-provider";
import { ClinicalTreatmentAutocomplete } from "@/features/historias/components/historias/clinical-treatment-autocomplete";
import { ConsultDiagnosisField } from "@/features/historias/components/historias/consult-diagnosis-field";
import { DiagnosisRelatedActionsPanel } from "@/features/historias/components/historias/diagnosis-related-actions-panel";
import { MedicationAutocomplete } from "@/features/historias/components/historias/medication-autocomplete";
import type {
  ClinicalDiagnosisEntry,
  ClinicalTreatmentEntry,
} from "@/features/historias/utils/clinical-structured-entries";

import { Textarea } from "@/components/ui/textarea";
import type { PrescriptionMedication } from "@/types/prescription";

type Props = {
  diagnoses: ClinicalDiagnosisEntry[];
  onDiagnosesChange: (diagnoses: ClinicalDiagnosisEntry[]) => void;
  clinicalTreatments: ClinicalTreatmentEntry[];
  onClinicalTreatmentsChange: (treatments: ClinicalTreatmentEntry[]) => void;
  medications: PrescriptionMedication[];
  onMedicationsChange: (medications: PrescriptionMedication[]) => void;
  indications: string;
  onIndicationsChange: (value: string) => void;
  diagnosisHighlighted?: boolean;
  treatmentHighlighted?: boolean;
  medicationHighlighted?: boolean;
  diagnosisSearchRef?: React.RefObject<HTMLInputElement | null>;
  treatmentSearchRef?: React.RefObject<HTMLInputElement | null>;
  medicationSearchRef?: React.RefObject<HTMLInputElement | null>;
  diagnosisAnchorRef?: React.RefObject<HTMLDivElement | null>;
};

/** Bloques clínicos compartidos de la evolución: dx / tx / medicación / plan. */
export function ConsultEvolutionStructuredFields(props: Props) {
  return (
    <ClinicalFavoritesProvider>
      <ConsultEvolutionStructuredFieldsInner {...props} />
    </ClinicalFavoritesProvider>
  );
}

function ConsultEvolutionStructuredFieldsInner({
  diagnoses,
  onDiagnosesChange,
  clinicalTreatments,
  onClinicalTreatmentsChange,
  medications,
  onMedicationsChange,
  indications,
  onIndicationsChange,
  diagnosisHighlighted = false,
  treatmentHighlighted = false,
  medicationHighlighted = false,
  diagnosisSearchRef,
  treatmentSearchRef,
  medicationSearchRef,
  diagnosisAnchorRef,
}: Props) {
  return (
    <div className="space-y-4">
      <section id="ehr-consult-diagnostico" ref={diagnosisAnchorRef} className="space-y-2">
        <ConsultDiagnosisField
          diagnoses={diagnoses}
          onDiagnosesChange={onDiagnosesChange}
          highlighted={diagnosisHighlighted}
          searchInputRef={diagnosisSearchRef}
          label="Diagnósticos"
          placeholder="Buscar diagnóstico…"
        />
        <DiagnosisRelatedActionsPanel
          diagnoses={diagnoses}
          treatments={clinicalTreatments}
          onTreatmentsChange={onClinicalTreatmentsChange}
        />
      </section>

      <section id="ehr-consult-tratamiento" className="space-y-2">
        <ClinicalTreatmentAutocomplete
          treatments={clinicalTreatments}
          onTreatmentsChange={onClinicalTreatmentsChange}
          label="Tratamiento / conducta"
          placeholder="Buscar tratamiento…"
          highlighted={treatmentHighlighted}
          searchInputRef={treatmentSearchRef}
        />
      </section>

      <section id="ehr-consult-medicacion" className="space-y-2">
        <MedicationAutocomplete
          medications={medications}
          onMedicationsChange={onMedicationsChange}
          searchInputRef={medicationSearchRef}
          highlighted={medicationHighlighted}
          label="Medicación"
          placeholder="Buscar medicamento…"
        />
      </section>

      <section id="ehr-consult-plan" className="space-y-2">
        <Textarea
          name="indications"
          label="Plan / indicaciones"
          rows={3}
          voiceInput
          value={indications}
          onChange={(e) => onIndicationsChange(e.target.value)}
          placeholder="Indicaciones generales del plan (opcional)…"
        />
      </section>
    </div>
  );
}
