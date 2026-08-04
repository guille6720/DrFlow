import type { PatientSearchOption } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import type { MedicalOrder } from "@/types/medical-order";
import type { ElectronicPrescription, PrescriptionMedication } from "@/types/prescription";

export type PrescriptionsOrdersTab = "receta" | "orden";

export type PrescriptionsOrdersProfessional = {
  id: string;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | null;
};

export type PrescriptionsOrdersPatient = PatientSearchOption & {
  birth_date?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
  phone?: string | null;
  email?: string | null;
  regular_medication?: string | null;
};

export type PrescriptionsOrdersPatientPrescription = ElectronicPrescription & {
  professionals?: {
    display_name?: string | null;
    license_number?: string | null;
    profiles?: { full_name?: string } | null;
    specialties?: { name?: string } | null;
  } | null;
};

export type PrescriptionsOrdersRecentPrescription = ElectronicPrescription & {
  patient_id: string;
  patients: {
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date?: string | null;
    insurance_provider?: string | null;
  };
  professionals: {
    display_name?: string | null;
    license_number?: string | null;
    profiles?: { full_name?: string } | null;
    specialties?: { name?: string } | null;
  };
};

export type PrescriptionsOrdersHubProps = {
  patients: PatientSearchOption[];
  professionals: PrescriptionsOrdersProfessional[];
  clinic: { name: string; address?: string | null; phone?: string | null };
  selectedPatient: PrescriptionsOrdersPatient | null;
  patientPrescriptions: PrescriptionsOrdersPatientPrescription[];
  patientOrders: (MedicalOrder & { order_type?: string })[];
  recentPrescriptions: PrescriptionsOrdersRecentPrescription[];
  prefillDiagnosis?: string;
  prefillCie10?: string;
  initialMedications?: PrescriptionMedication[];
  defaultProfessionalId?: string;
  defaultTab: PrescriptionsOrdersTab;
};
