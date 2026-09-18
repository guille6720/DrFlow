import "server-only";

import { getPublicSiteUrl } from "@/core/supabase/env";

import { sendTransactionalEmail } from "@/lib/services/transactional-email";

export function buildSubscriptionReceiptEmailContent(input: {
  clinicName: string;
  planName: string;
  cycleLabel: string;
  amountLabel: string;
  periodEndLabel: string;
}): { subject: string; text: string } {
  const siteUrl = getPublicSiteUrl();
  const subject = `Pago confirmado — NexClinic ${input.planName}`;
  const text = [
    `Gracias por activar NexClinic.`,
    "",
    `Consultorio: ${input.clinicName}`,
    `Plan: ${input.planName} (${input.cycleLabel})`,
    `Monto: ${input.amountLabel}`,
    `Próximo vencimiento: ${input.periodEndLabel}`,
    "",
    "Ya podés usar agenda, historias clínicas y recetas sin límite de prueba.",
    "",
    `NexClinic — ${siteUrl}`,
  ].join("\n");

  return { subject, text };
}

export async function sendSubscriptionReceiptEmail(input: {
  to: string;
  subject: string;
  text: string;
}) {
  return sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
