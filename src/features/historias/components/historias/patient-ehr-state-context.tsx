"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";
import { usePatientEhrState } from "@/features/pacientes/hooks/use-patient-ehr-state";
import type { PatientEhrClinicalRecordsPagination } from "@/features/pacientes/server/load-patient-ehr-data";
import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

type PatientEhrState = ReturnType<typeof usePatientEhrState>;

const PatientEhrStateContext = createContext<PatientEhrState | null>(null);

type ProviderProps = {
  consultations: PatientEhrConsultation[];
  attachments: PatientEhrAttachment[];
  patient: PatientEhrPatientInfo;
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  initialSelectedId?: string | null;
  patientId?: string;
  clinicalRecordsPagination?: PatientEhrClinicalRecordsPagination;
  children: ReactNode;
};

export function PatientEhrStateProvider({
  consultations,
  attachments,
  patient,
  diagnosisRows,
  treatmentRows,
  initialSelectedId = null,
  patientId,
  clinicalRecordsPagination,
  children,
}: ProviderProps) {
  const state = usePatientEhrState(
    consultations,
    attachments,
    {
      patient,
      diagnosisRows,
      treatmentRows,
    },
    initialSelectedId,
    { patientId, clinicalRecordsPagination }
  );
  return (
    <PatientEhrStateContext.Provider value={state}>{children}</PatientEhrStateContext.Provider>
  );
}

export function usePatientEhrStateContext(): PatientEhrState {
  const ctx = useContext(PatientEhrStateContext);
  if (!ctx) {
    throw new Error("usePatientEhrStateContext must be used within PatientEhrStateProvider");
  }
  return ctx;
}
