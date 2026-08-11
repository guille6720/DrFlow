import "server-only";

import nodemailer from "nodemailer";

import { getPublicSiteUrl } from "@/core/supabase/env";

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendTransactionalEmailResult =
  | { sent: true; provider: "resend" | "smtp" }
  | { sent: false; reason: string };

function getFromAddress(): string | null {
  const configured = process.env.EMAIL_FROM?.trim();
  if (configured) return configured;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  if (siteUrl.includes("opusorg.com")) {
    return "DrFlow <noreply@opusorg.com>";
  }

  return null;
}

function getSmtpPassword(): string | null {
  return process.env.SMTP_PASSWORD?.trim() ?? process.env.SMTP_PASS?.trim() ?? null;
}

async function sendViaResend(
  input: SendTransactionalEmailInput,
  from: string
): Promise<SendTransactionalEmailResult | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

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
      reason: body || `Resend respondió HTTP ${response.status}`,
    };
  }

  return { sent: true, provider: "resend" };
}

async function sendViaSmtp(
  input: SendTransactionalEmailInput,
  from: string
): Promise<SendTransactionalEmailResult | null> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT?.trim() || "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = getSmtpPassword();
  const secure = process.env.SMTP_SECURE?.trim() === "true" || port === 465;

  if (!user || !pass) {
    return {
      sent: false,
      reason: "SMTP_USER o SMTP_PASSWORD no están configurados en Vercel.",
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    ...(port === 587 && !secure
      ? { requireTLS: true, tls: { minVersion: "TLSv1.2" as const } }
      : {}),
  });

  try {
    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text.replace(/\n/g, "<br />"),
    });
    return { sent: true, provider: "smtp" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error SMTP desconocido";
    return { sent: false, reason: message };
  }
}

/** Mensaje claro para administradores cuando falla el envío. */
export function formatEmailSendError(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("535") || lower.includes("authentication failed")) {
    return [
      "El servidor de correo rechazó usuario o contraseña SMTP.",
      "En Vercel revisá SMTP_USER (email completo, ej. noreply@opusorg.com) y SMTP_PASSWORD.",
      "Copiá los mismos datos que Supabase → Authentication → SMTP Settings (Hostinger: puerto 465, SMTP_SECURE=true).",
    ].join(" ");
  }
  if (lower.includes("email_from no configurado") || lower.includes("resend_api_key")) {
    return "Falta configurar el envío de emails en Vercel (SMTP o RESEND_API_KEY). Ver .env.example.";
  }
  return reason.replace(/\s*Configurá RESEND_API_KEY.*$/i, "").trim();
}

export function getEmailConfigurationHint(): string {
  return "Configurá RESEND_API_KEY o SMTP_HOST + EMAIL_FROM en Vercel (Settings → Environment Variables). Ver .env.example.";
}

/** True when EMAIL_FROM and Resend or SMTP credentials are present (server env). */
export function isTransactionalEmailConfigured(): boolean {
  if (!process.env.EMAIL_FROM?.trim()) return false;
  if (process.env.RESEND_API_KEY?.trim()) return true;
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = getSmtpPassword();
  return Boolean(host && user && pass);
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendTransactionalEmailResult> {
  const from = getFromAddress();
  if (!from) {
    return {
      sent: false,
      reason: `EMAIL_FROM no configurado. ${getEmailConfigurationHint()}`,
    };
  }

  // SMTP primero: suele ser el mismo que Supabase Auth (emails desde @opusorg.com).
  const smtpResult = await sendViaSmtp(input, from);
  if (smtpResult?.sent) return smtpResult;

  const resendResult = await sendViaResend(input, from);
  if (resendResult?.sent) return resendResult;

  const reasons = [smtpResult?.reason, resendResult?.reason].filter(Boolean);
  if (reasons.length > 0) {
    return {
      sent: false,
      reason: `${reasons.join(" · ")}. ${getEmailConfigurationHint()}`,
    };
  }

  return {
    sent: false,
    reason: getEmailConfigurationHint(),
  };
}

export function buildClinicInviteEmailContent(input: {
  fullName: string;
  clinicName: string;
  email: string;
  password: string;
  credentialsPath?: string;
}): { subject: string; text: string } {
  const loginUrl = `${getPublicSiteUrl()}/login`;
  const credentialsUrl = input.credentialsPath
    ? `${getPublicSiteUrl()}${input.credentialsPath}`
    : `${getPublicSiteUrl()}/acceso-invitado`;
  const subject = `Acceso a DrFlow — ${input.clinicName}`;
  const text = [
    `Hola ${input.fullName},`,
    "",
    `Te dieron acceso al consultorio "${input.clinicName}" en DrFlow.`,
    "",
    "Podés ver tu usuario y contraseña en este enlace:",
    credentialsUrl,
    "",
    "Datos para ingresar:",
    `Usuario: ${input.email}`,
    `Contraseña: ${input.password}`,
    "",
    `Después podés iniciar sesión en: ${loginUrl}`,
    "",
    "Por seguridad, cambiá la contraseña después del primer acceso desde Configuración.",
    "",
    "DrFlow",
  ].join("\n");

  return { subject, text };
}
