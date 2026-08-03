import type { Clinic, UserRole } from "@/types/database";

export type ProfessionalIntakeDetail = {
  id: string;
  display_name: string | null;
  document_number?: string | null;
  email?: string | null;
  phone?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  office_phone?: string | null;
  office_address?: string | null;
  accepted_insurances?: string | null;
  intake_notes?: string | null;
  intake_completed_at?: string | null;
  location_id?: string | null;
  specialties?: { name: string } | null;
};

export type AvailabilityRuleRow = {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

export type ProfessionalIntakeLocation = {
  id: string;
  name: string;
  address: string | null;
};

export type ProfessionalIntakeViewProps = {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  locations: ProfessionalIntakeLocation[];
  professionals: ProfessionalIntakeDetail[];
  scheduleByProfessional: Record<string, AvailabilityRuleRow[]>;
};

export type ProfessionalIntakeDetailTab = "perfil" | "consultorio" | "horarios";
export type ProfessionalIntakeNewStep = "ficha" | "consultorio" | "agenda";

export const PROFESSIONAL_INTAKE_DETAIL_TABS: { id: ProfessionalIntakeDetailTab; label: string }[] =
  [
    { id: "perfil", label: "Perfil" },
    { id: "consultorio", label: "Consultorio" },
    { id: "horarios", label: "Horarios" },
  ];

export const PROFESSIONAL_INTAKE_NEW_STEPS: { id: ProfessionalIntakeNewStep; label: string }[] = [
  { id: "ficha", label: "1. Ficha" },
  { id: "consultorio", label: "2. Consultorio" },
  { id: "agenda", label: "3. Horarios" },
];
