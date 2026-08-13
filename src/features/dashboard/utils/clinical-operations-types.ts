export type LiveAppointment = {
  id: string;
  start_at: string;
  status: string;
  booking_source?: string | null;
  notes?: string | null;
  patient_id?: string | null;
  professional_id?: string | null;
  waiting_room_status?: string | null;
  waiting_room_entered_at?: string | null;
  patients?: {
    first_name: string;
    last_name: string;
    phone?: string | null;
    document_number?: string;
    birth_date?: string | null;
  } | null;
  professionals?: { profiles?: { full_name: string } | null } | null;
};

export type ClinicalOpsWaitingPriority = "urgent" | "high" | "normal";

export type ClinicalOpsEnrichedWaitingRow = {
  id: string;
  start_at: string;
  waiting_room_status: string | null;
  status: string;
  patient_id: string | null;
  professional_id?: string | null;
  notes: string | null;
  patients: {
    first_name: string;
    last_name: string;
    document_number?: string;
    phone?: string | null;
    birth_date?: string | null;
  } | null;
  professionals?: { profiles?: { full_name: string } | null } | null;
  age: number | null;
  waitingMinutes: number;
  allergies: string | null;
  priority: ClinicalOpsWaitingPriority;
  alerts: string[];
};

export type ClinicalOpsActivityMetrics = {
  waitingCount: number;
  attendedCount: number;
  averageWaitingMinutes: number | null;
  nextAppointment: LiveAppointment | null;
  delayedCount: number;
};

export type ClinicalOpsPendingOrder = {
  id: string;
  order_text: string;
  status: string;
  created_at: string;
  patient_id: string;
  patients: { first_name: string; last_name: string } | null;
};

export type ClinicalOpsLabResult = {
  id: string;
  file_name: string;
  created_at: string;
  patient_id: string;
  patients: { first_name: string; last_name: string } | null;
  severity: "critical" | "review" | "normal";
  isLab: boolean;
};

export type ClinicalOpsActionableAlert = {
  id: string;
  kind: "medication_allergy" | "delayed_appointment" | "urgent_waiting" | "pending_authorization";
  title: string;
  detail: string;
  patientId: string | null | undefined;
  href: string;
  severity: "critical" | "high" | "normal";
};

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
  status: string;
  medicationsSummary: string;
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
