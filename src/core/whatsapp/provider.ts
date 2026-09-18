import "server-only";

import type { WhatsAppDeliveryMode, WhatsAppSendTextInput, WhatsAppSendTextResult } from "@/core/whatsapp/types";

import { normalizeArgentinaPhone } from "@/shared/utils/whatsapp";

const DEFAULT_API_VERSION = "v21.0";
const WHATSAPP_API_TIMEOUT_MS = 20_000;

export function isWhatsAppApiConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  );
}

export function resolveWhatsAppDeliveryMode(): WhatsAppDeliveryMode {
  return isWhatsAppApiConfigured() ? "api" : "manual";
}

export function getWhatsAppConfigurationHint(): string {
  return "Configurá WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en Vercel (Meta Cloud API).";
}

function getApiVersion(): string {
  return process.env.WHATSAPP_API_VERSION?.trim() || DEFAULT_API_VERSION;
}

export function formatWhatsAppRecipient(phone: string): string | null {
  return normalizeArgentinaPhone(phone);
}

export async function sendWhatsAppTextMessage(
  input: WhatsAppSendTextInput
): Promise<WhatsAppSendTextResult> {
  if (!isWhatsAppApiConfigured()) {
    return { ok: false, error: getWhatsAppConfigurationHint(), mode: "api" };
  }

  const to = formatWhatsAppRecipient(input.to);
  if (!to) {
    return { ok: false, error: "Teléfono de WhatsApp inválido.", mode: "api" };
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN!.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  const version = getApiVersion();
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WHATSAPP_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: input.text },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        error: body || `WhatsApp API respondió HTTP ${response.status}`,
        mode: "api",
      };
    }

    const data = (await response.json()) as {
      messages?: Array<{ id?: string }>;
    };
    const messageId = data.messages?.[0]?.id?.trim();
    if (!messageId) {
      return { ok: false, error: "WhatsApp API no devolvió identificador de mensaje.", mode: "api" };
    }

    return { ok: true, messageId, mode: "api" };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "WhatsApp API timeout."
        : error instanceof Error
          ? error.message
          : "Error al enviar WhatsApp.";
    return { ok: false, error: message, mode: "api" };
  } finally {
    clearTimeout(timeout);
  }
}

export const WHATSAPP_MANUAL_DISCLAIMER =
  "Modo manual NexClinic: se abre WhatsApp con el mensaje prellenado — tenés que tocar Enviar.";

export const WHATSAPP_API_DISCLAIMER =
  "Mensaje enviado vía WhatsApp Business Cloud API (Meta).";
