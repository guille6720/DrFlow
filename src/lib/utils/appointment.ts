import type { Appointment } from "@/types/database";

export function isOnlineBooking(appointment: Pick<Appointment, "booking_source" | "notes">): boolean {
  if (appointment.booking_source === "online") return true;
  return (appointment.notes ?? "").toLowerCase().includes("solicitud online");
}

export function canStartConsultation(status: Appointment["status"]): boolean {
  return status === "pending" || status === "confirmed";
}
