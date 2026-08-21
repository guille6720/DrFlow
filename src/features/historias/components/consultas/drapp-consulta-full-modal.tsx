"use client";

import { useEffect, useId, useState } from "react";

import { ConsultEvolutionStructuredFields } from "@/features/historias/components/historias/consult-evolution-structured-fields";
import type { PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";
import type {
  ClinicalDiagnosisEntry,
  ClinicalTreatmentEntry,
} from "@/features/historias/utils/clinical-structured-entries";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PrescriptionMedication } from "@/types/prescription";

export type FullConsultaFormValues = {
  chiefComplaint: string;
  evolution: string;
  physicalExam: string;
  indications: string;
  observations: string;
  plan: string;
  diagnoses: ClinicalDiagnosisEntry[];
  clinicalTreatments: ClinicalTreatmentEntry[];
  medications: PrescriptionMedication[];
};

type Props = {
  open: boolean;
  patient: PatientEhrPatientInfo;
  initial?: Partial<FullConsultaFormValues>;
  saving: boolean;
  onClose: () => void;
  onSave: (values: FullConsultaFormValues) => Promise<void>;
};

const EMPTY: FullConsultaFormValues = {
  chiefComplaint: "",
  evolution: "",
  physicalExam: "",
  indications: "",
  observations: "",
  plan: "",
  diagnoses: [],
  clinicalTreatments: [],
  medications: [],
};

export function DrappConsultaFullModal({
  open,
  patient,
  initial,
  saving,
  onClose,
  onSave,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, saving]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/55 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="drflow-modal-panel drflow-dialog-panel my-4 w-full max-w-3xl rounded-lg border border-slate-200 bg-white text-slate-900 shadow-xl"
      >
        <FullConsultaForm
          key={`${patient.id}-${open}`}
          titleId={titleId}
          patient={patient}
          initial={initial}
          saving={saving}
          onClose={onClose}
          onSave={onSave}
        />
      </div>
    </div>
  );
}

function FullConsultaForm({
  titleId,
  patient,
  initial,
  saving,
  onClose,
  onSave,
}: {
  titleId: string;
  patient: PatientEhrPatientInfo;
  initial?: Partial<FullConsultaFormValues>;
  saving: boolean;
  onClose: () => void;
  onSave: (values: FullConsultaFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<FullConsultaFormValues>(() => ({
    ...EMPTY,
    ...initial,
  }));

  return (
    <>
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 id={titleId} className="text-base font-semibold text-slate-900">
          Consulta / evolución
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {patient.last_name}, {patient.first_name} · DNI {patient.document_number}
          {patient.phone ? ` · ${patient.phone}` : ""}
          {patient.insurance_provider ? ` · ${patient.insurance_provider}` : ""}
          {patient.insurance_number ? ` Nº ${patient.insurance_number}` : ""}
        </p>
      </div>

      <div className="max-h-[75vh] space-y-3 overflow-y-auto px-4 py-4">
        <Textarea
          label="Motivo de consulta"
          rows={2}
          value={values.chiefComplaint}
          onChange={(e) => setValues((v) => ({ ...v, chiefComplaint: e.target.value }))}
        />
        <Textarea
          label="Evolución"
          rows={5}
          value={values.evolution}
          onChange={(e) => setValues((v) => ({ ...v, evolution: e.target.value }))}
        />
        <Textarea
          label="Examen físico"
          rows={3}
          value={values.physicalExam}
          onChange={(e) => setValues((v) => ({ ...v, physicalExam: e.target.value }))}
        />
        <ConsultEvolutionStructuredFields
          diagnoses={values.diagnoses}
          onDiagnosesChange={(diagnoses) => setValues((v) => ({ ...v, diagnoses }))}
          clinicalTreatments={values.clinicalTreatments}
          onClinicalTreatmentsChange={(clinicalTreatments) =>
            setValues((v) => ({ ...v, clinicalTreatments }))
          }
          medications={values.medications}
          onMedicationsChange={(medications) => setValues((v) => ({ ...v, medications }))}
          indications={values.indications}
          onIndicationsChange={(indications) => setValues((v) => ({ ...v, indications }))}
        />
        <Textarea
          label="Observaciones"
          rows={2}
          value={values.observations}
          onChange={(e) => setValues((v) => ({ ...v, observations: e.target.value }))}
        />
        <Textarea
          label="Conducta / plan"
          rows={2}
          value={values.plan}
          onChange={(e) => setValues((v) => ({ ...v, plan: e.target.value }))}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          loading={saving}
          pendingLabel="Guardando..."
          disabled={!values.evolution.trim() && !values.chiefComplaint.trim()}
          onClick={() => void onSave(values)}
        >
          Guardar consulta
        </Button>
      </div>
    </>
  );
}
