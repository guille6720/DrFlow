"use server";

import { getSession } from "@/core/auth/session";
import { entityIdSchema } from "@/core/validations/params";
import { purgeSoleOwnerClinicsForUserInternal } from "@/core/account/purge-sole-owner-clinics";

/** Borra clínicas donde el usuario es el único miembro activo. Solo el propio usuario autenticado. */
export async function purgeSoleOwnerClinicsForUser(userId: string): Promise<{ error?: string }> {
  const idParsed = entityIdSchema.safeParse(userId);
  if (!idParsed.success) return { error: "Usuario inválido" };

  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };
  if (user.id !== idParsed.data) return { error: "Sin permisos" };

  return purgeSoleOwnerClinicsForUserInternal(idParsed.data);
}
