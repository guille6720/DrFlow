import "server-only";

import { sendTransactionalEmail } from "@/lib/services/transactional-email";
import type { ReminderStatus } from "@/types/database";

export type DeliverReminderEmailResult = {
  status: Extract<ReminderStatus, "sent" | "failed">;
  errorMessage?: string;
  provider?: "resend" | "smtp";
};

export async function deliverReminderEmail(input: {
  to: string;
  message: string;
  subject?: string;
}): Promise<DeliverReminderEmailResult> {
  const result = await sendTransactionalEmail({
    to: input.to,
    subject: input.subject ?? "Recordatorio de turno — NexClinic",
    text: input.message,
  });

  if (result.sent) {
    return { status: "sent", provider: result.provider };
  }

  return {
    status: "failed",
    errorMessage: result.reason ?? "No se pudo enviar el email",
  };
}
