import type { PrescriptionMedication } from "@/types/prescription";
import type { LabPanelRow } from "@/lib/utils/patient-chart-notes";

export type PatientChartExtras = {
  sex?: string | null;
  blood_group?: string | null;
  smoker?: "never" | "former" | "active" | null;
  alcohol?: string | null;
  activity?: string | null;
  diet?: string | null;
  occupation?: string | null;
  pack_years?: number | null;
  anticoagulated?: boolean;
  pacemaker?: boolean;
  renal_failure?: boolean;
  heart_failure?: boolean;
  cardiovascular_risk?: "low" | "moderate" | "high" | null;
  family_history?: { relation: string; conditions: string }[];
  vaccines?: { name: string; status: "ok" | "warn" | "missing"; year?: string }[];
  labs?: { name: string; value: string; unit?: string; status: "normal" | "high" | "low" | "unknown"; date?: string }[];
};

export type ChartAlert = {
  level: "red" | "yellow" | "green";
  label: string;
};

export type ActiveProblem = {
  id: string;
  name: string;
  dateLabel: string;
  status: "active" | "resolved";
  professionalName: string;
  recordId?: string;
};

export type MedicationCard = {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  sinceLabel: string;
  lastRenewalLabel: string;
  raw: PrescriptionMedication;
};

export type VitalReading = {
  id: string;
  date: string;
  label: string;
  systolic?: number;
  diastolic?: number;
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  heartRate?: number;
  temperature?: number;
  spo2?: number;
  abdominalCm?: number;
  raw: string;
};

export type ConsultationTimelineItem = {
  id: string;
  dateLabel: string;
  motive: string;
  diagnosis: string;
  conduct: string;
};

export type StudyDocumentItem = {
  id: string;
  file_name: string;
  category: string | null;
  created_at: string;
  uploaded_by?: string | null;
};

export type PatientChartPayload = {
  ageLabel: string | null;
  ageYears: number | null;
  sex: string;
  insurance: string;
  bloodGroup: string;
  activeProblemsText: string[];
  chronicConditions: string[];
  allergies: string[];
  criticalMeds: string[];
  anticoagulated: boolean;
  cvRisk: string;
  smokingLabel: string;
  alerts: ChartAlert[];
  problems: ActiveProblem[];
  medications: MedicationCard[];
  vitals: VitalReading[];
  latestVitals: {
    ta?: string;
    fc?: string;
    weight?: string;
    height?: string;
    bmi?: string;
    temp?: string;
    spo2?: string;
    abdominal?: string;
  };
  labPanel: LabPanelRow[];
  profileCompleteness: { score: number; missing: string[] };
  consultations: ConsultationTimelineItem[];
  labs: PatientChartExtras["labs"];
  vaccines: PatientChartExtras["vaccines"];
  habits: {
    smoker: string;
    alcohol: string;
    activity: string;
    diet: string;
    occupation: string;
    packYears: string;
  };
  family: PatientChartExtras["family_history"];
  studies: StudyDocumentItem[];
  documents: StudyDocumentItem[];
  reminders: string[];
  safetyWarnings: string[];
  indicators: {
    bmi: string | null;
    tfg: string | null;
    cvScore: string | null;
    packYears: string | null;
  };
  extras: PatientChartExtras;
};
