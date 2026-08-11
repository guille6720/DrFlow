import "server-only";

import { sendTransactionalEmail } from "@/lib/services/transactional-email";

export function buildSubscriptionReceiptEmailContent(input: {
  clinicName: string;
  planName: string;
  cycleLabel: string;
  amountLabel: string;
  periodEndLabel: string;
}): { subject: string; text: string } {
  const subject = `Pago confirmado — DrFlow ${input.planName}`;
  const text = [
    `Gracias por activar DrFlow.`,
    "",
    `Consultorio: ${input.clinicName}`,
    `Plan: ${input.planName} (${input.cycleLabel})`,
    `Monto: ${input.amountLabel}`,
    `Próximo vencimiento: ${input.periodEndLabel}`,
    "",
    "Ya podés usar agenda, historias clínicas y recetas sin límite de prueba.",
    "",
    "DrFlow — https://drflow.opusorg.com",
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
