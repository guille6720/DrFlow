import "server-only";

import {
  getWhatsAppConfigurationHint,
  isWhatsAppApiConfigured,
  resolveWhatsAppDeliveryMode,
  sendWhatsAppTextMessage,
} from "@/core/whatsapp/provider";
import type { DeliverWhatsAppMessageResult } from "@/core/whatsapp/types";

import { buildWhatsAppUrl } from "@/shared/utils/whatsapp";

export { getWhatsAppConfigurationHint, isWhatsAppApiConfigured, resolveWhatsAppDeliveryMode };

export async function deliverWhatsAppMessage(input: {
  to: string;
  text: string;
}): Promise<DeliverWhatsAppMessageResult> {
  if (!isWhatsAppApiConfigured()) {
    const whatsappUrl = buildWhatsAppUrl(input.to, input.text);
    if (!whatsappUrl) {
      return {
        status: "failed",
        mode: "api",
        errorMessage: "Teléfono de WhatsApp inválido.",
      };
    }
    return { status: "manual", mode: "manual", whatsappUrl };
  }

  const result = await sendWhatsAppTextMessage({
    to: input.to,
    text: input.text,
  });

  if (!result.ok) {
    return {
      status: "failed",
      mode: "api",
      errorMessage: result.error || getWhatsAppConfigurationHint(),
    };
  }

  return {
    status: "sent",
    mode: "api",
    messageId: result.messageId,
  };
}
