import { type FeatureKey, FEATURES } from "@/core/entitlements/features";
import { isFeatureEntitledBySnapshot } from "@/core/entitlements/snapshot-access";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

/** UX-only mapping: sidebar/command href → commercial feature. */
export const NAV_ENTITLEMENT_BY_HREF: Partial<Record<string, FeatureKey>> = {
  "/guia-pami": FEATURES.PAMI,
  "/pami/planillas": FEATURES.PAMI,
  "/gemini": FEATURES.AI,
  "/recordatorios": FEATURES.WHATSAPP_REMINDERS,
  "/reportes/bi": FEATURES.ADVANCED_REPORTS,
  "/telemedicina": FEATURES.TELEMEDICINE,
  "/herramientas/farmacologia": FEATURES.PHARMACOLOGY,
  "/facturacion/liquidacion": FEATURES.INSURANCE,
  "/facturacion/tarifas": FEATURES.INSURANCE,
  "/caja": FEATURES.CASH_REGISTER,
};

export function navFeatureForHref(href: string): FeatureKey | undefined {
  const exact = NAV_ENTITLEMENT_BY_HREF[href];
  if (exact) return exact;
  if (href.startsWith("/caja/")) return FEATURES.CASH_REGISTER;
  if (href.startsWith("/facturacion/")) return FEATURES.INSURANCE;
  if (href.startsWith("/telemedicina/")) return FEATURES.TELEMEDICINE;
  if (href.startsWith("/herramientas/farmacologia")) return FEATURES.PHARMACOLOGY;
  return undefined;
}

/** UX only. Missing catalog fails open. */
export function isHrefEntitledBySnapshot(
  href: string,
  snapshot: ClientEntitlementsSnapshot | null
): boolean {
  return isFeatureEntitledBySnapshot(navFeatureForHref(href), snapshot);
}

/** Drops add-on deep links the plan does not include. Items without href stay. */
export function filterEntitledHrefItems<T extends { href?: string | null }>(
  items: T[],
  snapshot: ClientEntitlementsSnapshot | null
): T[] {
  return items.filter((item) => !item.href || isHrefEntitledBySnapshot(item.href, snapshot));
}
