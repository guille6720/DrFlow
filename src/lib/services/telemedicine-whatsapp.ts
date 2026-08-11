import "server-only";

import { buildTelemedicineMessage } from "@/lib/services/telemedicine";
import { deliverWhatsAppMessage } from "@/lib/services/whatsapp-message";

export type DeliverTelemedicineWhatsAppResult =
  | { status: "sent"; messageId: string }
  | { status: "manual"; whatsappUrl: string }
  | { status: "failed"; errorMessage: string };

export async function deliverTelemedicineLinkWhatsApp(input: {
  to: string;
  patientName: string;
  appointmentDate: string;
  clinicName: string;
  joinUrl: string;
}): Promise<DeliverTelemedicineWhatsAppResult> {
  const text = buildTelemedicineMessage({
    patientName: input.patientName,
    appointmentDate: input.appointmentDate,
    clinicName: input.clinicName,
    joinUrl: input.joinUrl,
  });

  const result = await deliverWhatsAppMessage({ to: input.to, text });

  if (result.status === "sent") {
    return { status: "sent", messageId: result.messageId };
  }
  if (result.status === "manual") {
    return { status: "manual", whatsappUrl: result.whatsappUrl };
  }
  return { status: "failed", errorMessage: result.errorMessage };
}
