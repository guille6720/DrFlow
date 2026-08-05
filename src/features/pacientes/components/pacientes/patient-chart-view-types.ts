import type { ClinicalDocumentItem } from "@/features/historias/components/historias/clinical-documents-panel";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";
import type { PrescriptionMedication } from "@/types/prescription";

export type PatientChartProfessional = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  profiles?: { full_name: string } | null;
};

export type PatientChartPatient = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  allergies: string | null;
  regular_medication: string | null;
};

export type PatientChartAppointment = {
  id: string;
  start_at: string;
  status: string;
  cancellation_reason?: string | null;
  cancelled_by_type?: string | null;
  professionals?: { profiles?: { full_name?: string } } | null;
};

/** @deprecated Use PatientChartAppointment */
export type AppointmentRow = PatientChartAppointment;

export type PatientChartViewProps = {
  patient: PatientChartPatient;
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
  canIssue: boolean;
  professionals: PatientChartProfessional[];
  lastMedications: PrescriptionMedication[] | null;
  clinicalDocuments: ClinicalDocumentItem[];
  appointments: PatientChartAppointment[];
  portalSlug: string | null;
  doctorInfo: DoctorShareInfo | null;
  patientShare: { sharedAt: string; sharedByName: string | null; channel: string } | null;
  arcoExport?: React.ReactNode;
  regularMedication?: string | null;
  /** Oculta la barra sticky duplicada cuando hay tabs de workspace arriba. */
  workspaceMode?: boolean;
};
