import "server-only";

import { deliverWhatsAppMessage } from "@/lib/services/whatsapp-message";
import type { ReminderStatus } from "@/types/database";

export type DeliverReminderWhatsAppResult = {
  status: Extract<ReminderStatus, "sent" | "failed" | "simulated">;
  errorMessage?: string;
  whatsappUrl?: string;
  messageId?: string;
  deliveryMode?: "api" | "manual";
};

export async function deliverReminderWhatsApp(input: {
  to: string;
  message: string;
}): Promise<DeliverReminderWhatsAppResult> {
  const result = await deliverWhatsAppMessage({
    to: input.to,
    text: input.message,
  });

  if (result.status === "sent") {
    return {
      status: "sent",
      messageId: result.messageId,
      deliveryMode: "api",
    };
  }

  if (result.status === "manual") {
    return {
      status: "simulated",
      whatsappUrl: result.whatsappUrl,
      deliveryMode: "manual",
    };
  }

  return {
    status: "failed",
    errorMessage: result.errorMessage,
    deliveryMode: "api",
  };
}
