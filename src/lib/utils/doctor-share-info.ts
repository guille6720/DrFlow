import { PATIENT_CONTACT_PHONE_DISCLAIMER } from "@/lib/constants/medical-specialties";

export interface DoctorShareInfo {
  fullName: string;
  licenseLabel: string | null;
  specialty: string | null;
  phone: string | null;
  clinicName: string;
}

export function buildSharePhoneLine(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  return `Tel. ${phone.trim()} — ${PATIENT_CONTACT_PHONE_DISCLAIMER}`;
}

export { PATIENT_CONTACT_PHONE_DISCLAIMER };
