export type UserRole =
  | "superadmin"
  | "clinic_admin"
  | "doctor"
  | "secretary"
  | "patient";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "attended"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "pending" | "paid" | "rejected";

export type ReminderChannel = "email" | "whatsapp" | "internal";

export type ReminderStatus = "queued" | "sent" | "failed" | "simulated";

export type TelemedicineStatus =
  | "scheduled"
  | "active"
  | "completed"
  | "cancelled";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
}

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  default_appointment_duration: number;
  timezone: string;
  is_active: boolean;
  default_insurance_provider?: string | null;
  practice_profile?: string | null;
}

export interface ClinicMember {
  id: string;
  clinic_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  clinic?: Clinic;
}

export interface Patient {
  id: string;
  clinic_id: string;
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
  medical_history: string | null;
  allergies: string | null;
  regular_medication: string | null;
  notes: string | null;
  created_at: string;
}

export interface Professional {
  id: string;
  clinic_id: string;
  user_id: string | null;
  specialty_id: string | null;
  location_id: string | null;
  license_number: string | null;
  display_name: string | null;
  bio: string | null;
  is_active: boolean;
  profiles?: Profile;
  specialties?: { name: string };
}

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  location_id: string | null;
  specialty_id: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  notes: string | null;
  booking_source?: "manual" | "online" | null;
  cancellation_reason: string | null;
  patients?: Patient;
  professionals?: Professional;
  locations?: { name: string };
  specialties?: { name: string };
}

export interface ClinicalRecord {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  professional_id: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  evolution: string | null;
  indications: string | null;
  professional_signature: string | null;
  created_at: string;
  updated_at: string;
  patients?: Patient;
  professionals?: Professional;
}

export interface ReminderLog {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  recipient: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  patient_id: string;
  amount: number;
  deposit_amount: number;
  status: PaymentStatus;
  mock_transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  patients?: Patient;
}

export interface DashboardStats {
  todayAppointments: number;
  newPatients: number;
  completedConsultations: number;
  cancelledAppointments: number;
  noShowRate: number;
  upcomingAppointments: Appointment[];
}
