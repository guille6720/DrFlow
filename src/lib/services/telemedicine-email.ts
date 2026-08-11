import "server-only";

import { buildTelemedicineMessage } from "@/lib/services/telemedicine";
import { sendTransactionalEmail } from "@/lib/services/transactional-email";

export type DeliverTelemedicineEmailResult =
  | { status: "sent"; provider: "resend" | "smtp" }
  | { status: "failed"; errorMessage: string };

export async function deliverTelemedicineLinkEmail(input: {
  to: string;
  patientName: string;
  appointmentDate: string;
  clinicName: string;
  joinUrl: string;
}): Promise<DeliverTelemedicineEmailResult> {
  const text = buildTelemedicineMessage({
    patientName: input.patientName,
    appointmentDate: input.appointmentDate,
    clinicName: input.clinicName,
    joinUrl: input.joinUrl,
  });

  const result = await sendTransactionalEmail({
    to: input.to,
    subject: `Videoconsulta — ${input.clinicName}`,
    text,
  });

  if (result.sent) {
    return { status: "sent", provider: result.provider };
  }

  return {
    status: "failed",
    errorMessage: result.reason ?? "No se pudo enviar el email",
  };
}
