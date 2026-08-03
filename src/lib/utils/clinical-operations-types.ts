import type { LiveAppointment } from "@/components/dashboard/consultorio-live-panel";

export type ClinicalOpsWaitingRow = {
  id: string;
  start_at: string;
  waiting_room_status: string | null;
  status: string;
  patient_id: string | null;
  patients: {
    first_name: string;
    last_name: string;
    document_number?: string;
    phone?: string | null;
    allergies?: string | null;
  } | null;
  professionals?: { profiles?: { full_name: string } | null } | null;
};

export type ClinicalOpsDraftPrescription = {
  id: string;
  created_at: string;
  patient_id: string;
  patients: { first_name: string; last_name: string; document_number: string } | null;
};

export type ClinicalOpsPendingStudy = {
  id: string;
  file_name: string;
  created_at: string;
  patient_id: string;
  patients: { first_name: string; last_name: string } | null;
};

export type ClinicalOpsCriticalPatient = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  allergies: string | null;
  reason: string;
};

export type ClinicalOpsNotification = {
  id: string;
  kind: "no_show" | "cancelled" | "overdue";
  label: string;
  at: string;
  patientName: string;
  href: string;
};

export type ClinicalOperationsPayload = {
  waiting: ClinicalOpsWaitingRow[];
  upcoming: LiveAppointment[];
  overdue: ClinicalOpsWaitingRow[];
  draftPrescriptions: ClinicalOpsDraftPrescription[];
  pendingStudies: ClinicalOpsPendingStudy[];
  criticalPatients: ClinicalOpsCriticalPatient[];
  notifications: ClinicalOpsNotification[];
};
