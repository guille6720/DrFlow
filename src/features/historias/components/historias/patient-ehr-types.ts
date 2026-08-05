import {
  Activity,
  ClipboardList,
  FileStack,
  Pill,
  Stethoscope,
} from "lucide-react";

import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrPrescription,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

export type PatientEhrFilterKey =
  | "evolutions"
  | "files"
  | "diagnostics"
  | "treatments"
  | "vitals"
  | "prescriptions";

export const PATIENT_EHR_FILTER_OPTIONS: {
  key: PatientEhrFilterKey;
  label: string;
  icon: typeof Stethoscope;
}[] = [
  { key: "evolutions", label: "Evoluciones", icon: Stethoscope },
  { key: "files", label: "Archivos", icon: FileStack },
  { key: "diagnostics", label: "Diagnósticos", icon: Stethoscope },
  { key: "treatments", label: "Tratamientos", icon: Pill },
  { key: "vitals", label: "Signos vitales", icon: Activity },
  { key: "prescriptions", label: "Recetas", icon: ClipboardList },
];

export type PatientEhrPatientInfo = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  age_label: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  phone: string | null;
  email?: string | null;
};

export type PatientEhrViewProps = {
  patient: PatientEhrPatientInfo;
  consultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  attachments: PatientEhrAttachment[];
  prescriptions: PatientEhrPrescription[];
  totalConsultations: number;
  usesHceExport?: boolean;
  /** Oculta barra demográfica cuando la HC está embebida en el workspace del paciente. */
  embedded?: boolean;
};

export type PatientEhrFilters = Record<PatientEhrFilterKey, boolean>;

export type PatientEhrPrintScope = "all" | "day";

export const DEFAULT_PATIENT_EHR_FILTERS: PatientEhrFilters = {
  evolutions: true,
  files: true,
  diagnostics: true,
  treatments: true,
  vitals: true,
  prescriptions: true,
};
