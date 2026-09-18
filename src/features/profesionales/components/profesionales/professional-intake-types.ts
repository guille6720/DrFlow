import type { ProfessionalListItem } from "@/features/profesionales/components/profesionales/professional-intake-sidebar";

import type { EnrichedTeamMember } from "@/lib/utils/team-member-display";
import type { Clinic, UserRole } from "@/types/database";

export type ProfessionalIntakeDetail = {
  id: string;
  display_name: string | null;
  document_number?: string | null;
  email?: string | null;
  phone?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  license_number?: string | null;
  office_phone?: string | null;
  office_address?: string | null;
  accepted_insurances?: string | null;
  intake_notes?: string | null;
  intake_completed_at?: string | null;
  location_id?: string | null;
  tax_id?: string | null;
  cuil?: string | null;
  licensing_jurisdiction?: string | null;
  issuing_authority?: string | null;
  refeps_identifier?: string | null;
  refeps_specialty?: string | null;
  refeps_validation_status?: import("@/core/renapdis/types").RefepsValidationStatus;
  refeps_validated_at?: string | null;
  refeps_validation_error?: string | null;
  iva_status?: string | null;
  bank_name?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  bank_cbu?: string | null;
  bank_alias?: string | null;
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
  sidebarProfessionals: ProfessionalListItem[];
  initialSelectedProfessional: ProfessionalIntakeDetail | null;
  initialScheduleRules: AvailabilityRuleRow[];
  teamMembers: EnrichedTeamMember[];
  invitedMembers: EnrichedTeamMember[];
  mfaStatus: import("@/core/auth/prescriber-mfa.types").PrescriberMfaStatus;
  canPrescribe: boolean;
};

export type ProfessionalIntakeDetailTab = "perfil" | "consultorio" | "horarios" | "datos_bancarios";
export type ProfessionalIntakeNewStep = "ficha" | "consultorio" | "agenda";

export const PROFESSIONAL_INTAKE_DETAIL_TABS: { id: ProfessionalIntakeDetailTab; label: string }[] =
  [
    { id: "perfil", label: "Perfil" },
    { id: "consultorio", label: "Consultorio" },
    { id: "horarios", label: "Horarios" },
    { id: "datos_bancarios", label: "Datos Bancarios" },
  ];

export const PROFESSIONAL_INTAKE_NEW_STEPS: { id: ProfessionalIntakeNewStep; label: string }[] = [
  { id: "ficha", label: "1. Ficha" },
  { id: "consultorio", label: "2. Consultorio" },
  { id: "agenda", label: "3. Horarios" },
];
