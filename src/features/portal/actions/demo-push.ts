"use server";

import { getLaMejorDemoPublicPortal, isPublicPortalAllowedForSlug } from "@/core/entitlements/public-portal.server";
import { forgetDemoPushDevice, rememberDemoPushDevice } from "@/core/portal/demo-push.server";

export async function enableDemoTurnNotifications(slug: string, subscription: unknown) {
  const clinic = await getLaMejorDemoPublicPortal(slug);
  if (!clinic?.trial_ends_at || !(await isPublicPortalAllowedForSlug(slug))) {
    return { error: "Los recordatorios no están disponibles." };
  }
  return await rememberDemoPushDevice(subscription, new Date(clinic.trial_ends_at))
    ? { success: true }
    : { error: "No pudimos guardar los recordatorios en este dispositivo." };
}

export async function disableDemoTurnNotifications(slug: string) {
  if (!(await getLaMejorDemoPublicPortal(slug))) return { error: "La demo ya no está disponible." };
  return await forgetDemoPushDevice()
    ? { success: true }
    : { error: "No pudimos desactivar los recordatorios." };
}
