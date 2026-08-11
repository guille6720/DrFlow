export type WhatsAppDeliveryMode = "api" | "manual";

export type WhatsAppSendTextInput = {
  to: string;
  text: string;
};

export type WhatsAppSendTextResult =
  | { ok: true; messageId: string; mode: "api" }
  | { ok: false; error: string; mode: "api" };

export type DeliverWhatsAppMessageResult =
  | { status: "sent"; mode: "api"; messageId: string }
  | { status: "manual"; mode: "manual"; whatsappUrl: string }
  | { status: "failed"; mode: "api"; errorMessage: string };
