import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";

export function buildAppointmentConfirmationMessage(startAt: string): string {
  const dateLabel = formatClinicDateTime(startAt, "EEEE d 'de' MMMM 'a las' HH:mm 'hs'");
  return [
    `Su turno del ${dateLabel} ha sido confirmado.`,
    "Esperamos su presencia.",
    "En caso de no poder concurrir, por favor cancelá el turno en la App.",
    "Desde ya, muchas gracias.",
  ].join(" ");
}

export function buildAppointmentCancellationByClinicMessage(
  startAt: string,
  reason: string
): string {
  const dateLabel = formatClinicDateTime(startAt, "EEEE d 'de' MMMM 'a las' HH:mm 'hs'");
  return [
    `Le informamos que su turno del ${dateLabel} fue cancelado por el consultorio.`,
    `Motivo: ${reason}`,
    "Podés solicitar un nuevo turno desde la App.",
  ].join(" ");
}
