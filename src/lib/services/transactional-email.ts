import { getPublicSiteUrl } from "@/core/supabase/env";

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendTransactionalEmailResult =
  | { sent: true; provider: "resend" }
  | { sent: false; reason: string };

function getFromAddress(): string | null {
  const from = process.env.EMAIL_FROM?.trim();
  return from || null;
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendTransactionalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getFromAddress();

  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY no configurada" };
  }
  if (!from) {
    return { sent: false, reason: "EMAIL_FROM no configurado" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text.replace(/\n/g, "<br />"),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      sent: false,
      reason: body || `Error HTTP ${response.status} al enviar email`,
    };
  }

  return { sent: true, provider: "resend" };
}

export function buildClinicInviteEmailContent(input: {
  fullName: string;
  clinicName: string;
  email: string;
  password: string;
}): { subject: string; text: string } {
  const loginUrl = `${getPublicSiteUrl()}/login`;
  const subject = `Acceso a DrFlow — ${input.clinicName}`;
  const text = [
    `Hola ${input.fullName},`,
    "",
    `Te dieron acceso al consultorio "${input.clinicName}" en DrFlow.`,
    "",
    "Datos para ingresar:",
    `Usuario: ${input.email}`,
    `Contraseña: ${input.password}`,
    "",
    `Ingresá en: ${loginUrl}`,
    "",
    "Por seguridad, cambiá la contraseña después del primer acceso desde Configuración.",
    "",
    "DrFlow",
  ].join("\n");

  return { subject, text };
}
