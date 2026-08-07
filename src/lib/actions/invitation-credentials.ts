"use server";

import { findInvitationCredentialsByEmail } from "@/lib/server/invitation-credentials";

export async function lookupInvitationCredentialsByEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Ingresá un email válido." };
  }

  const credentials = await findInvitationCredentialsByEmail(email);
  if (!credentials) {
    return {
      error:
        "No encontramos una invitación activa con credenciales para ese email. Verificá el dato o pedile el enlace a quien te invitó.",
    };
  }

  return { invitationId: credentials.id };
}
