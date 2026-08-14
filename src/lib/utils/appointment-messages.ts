import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";

export function buildAppointmentConfirmationMessage(startAt: string): string {
  const dateLabel = formatClinicDateTime(startAt, "EEEE d/MM/yyyy HH:mm");
  return [
    `Su turno del ${dateLabel} hs ha sido confirmado.`,
    "Esperamos su presencia.",
    "En caso de no poder concurrir, por favor cancelá el turno en la App.",
    "Desde ya, muchas gracias.",
  ].join(" ");
}

export function buildAppointmentCancellationByClinicMessage(
  startAt: string,
  reason: string
): string {
  const dateLabel = formatClinicDateTime(startAt, "EEEE d/MM/yyyy HH:mm");
  return [
    `Le informamos que su turno del ${dateLabel} hs fue cancelado por el consultorio.`,
    `Motivo: ${reason}`,
    "Podés solicitar un nuevo turno desde la App.",
  ].join(" ");
}
