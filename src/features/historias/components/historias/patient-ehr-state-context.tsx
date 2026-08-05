"use client";

import { createContext, type ReactNode, useContext } from "react";

import { usePatientEhrState } from "@/features/pacientes/hooks/use-patient-ehr-state";
import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
} from "@/features/pacientes/utils/patient-ehr-model";

type PatientEhrState = ReturnType<typeof usePatientEhrState>;

const PatientEhrStateContext = createContext<PatientEhrState | null>(null);

type ProviderProps = {
  consultations: PatientEhrConsultation[];
  attachments: PatientEhrAttachment[];
  children: ReactNode;
};

export function PatientEhrStateProvider({ consultations, attachments, children }: ProviderProps) {
  const state = usePatientEhrState(consultations, attachments);
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
