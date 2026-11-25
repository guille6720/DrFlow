import type { Appointment } from "@/types/database";

export const LAMEJOR_DEMO_CLINIC_ID = "3e31ffeb-052f-46d2-9eeb-2f69fb1b34fa";

export function isLaMejorDemoOnlineAppointment(appointment: {
  clinic_id: string;
  booking_source?: string | null;
}): boolean {
  return appointment.clinic_id === LAMEJOR_DEMO_CLINIC_ID && appointment.booking_source === "online";
}

export function isOnlineBooking(appointment: {
  booking_source?: string | null;
  notes?: string | null;
}): boolean {
  if (appointment.booking_source === "online") return true;
  return (appointment.notes ?? "").toLowerCase().includes("solicitud online");
}

export function canStartConsultation(status: Appointment["status"]): boolean {
  return status === "pending" || status === "confirmed";
}
