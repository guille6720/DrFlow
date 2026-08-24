import type { Appointment } from "@/types/database";

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
