import { isFeatureEnforced } from "@/core/entitlements/enforcement";
import { commercialFeatureLabel } from "@/core/entitlements/feature-labels";
import { type FeatureKey, FEATURES } from "@/core/entitlements/features";
import { isFeatureEntitledBySnapshot } from "@/core/entitlements/snapshot-access";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

/** Boolean add-ons shown in Configuración → Tu plan. Branding has no UI; skip. */
export const VISIBLE_COMMERCIAL_MODULES = [
  FEATURES.PAMI,
  FEATURES.INSURANCE,
  FEATURES.CASH_REGISTER,
  FEATURES.PHARMACOLOGY,
  FEATURES.PORTAL,
  FEATURES.PDF_EXPORT,
  FEATURES.DATA_EXPORT,
  FEATURES.ADVANCED_REPORTS,
  FEATURES.WHATSAPP,
  FEATURES.WHATSAPP_REMINDERS,
  FEATURES.AUTOMATION,
  FEATURES.AUTOMATION_FOLLOW_UP,
  FEATURES.AI,
  FEATURES.TELEMEDICINE,
  FEATURES.VOICE,
  FEATURES.INTEGRATIONS,
  FEATURES.API,
] as const satisfies readonly FeatureKey[];

export type CommercialModuleRow = {
  key: FeatureKey;
  label: string;
};

export function listCommercialModuleAvailability(
  snapshot: Pick<ClientEntitlementsSnapshot, "catalogAvailable" | "allowed"> | null
): { included: CommercialModuleRow[]; excluded: CommercialModuleRow[] } {
  if (!snapshot?.catalogAvailable) return { included: [], excluded: [] };

  const included: CommercialModuleRow[] = [];
  const excluded: CommercialModuleRow[] = [];

  for (const key of VISIBLE_COMMERCIAL_MODULES) {
    if (!isFeatureEnforced(key)) continue;
    const row = { key, label: commercialFeatureLabel(key) };
    if (snapshot.allowed[key] === true) included.push(row);
    else excluded.push(row);
  }

  return { included, excluded };
}

export function areFeaturesEntitledBySnapshot(
  featureKeys: FeatureKey[],
  snapshot: ClientEntitlementsSnapshot | null
): boolean {
  return featureKeys.every((featureKey) => isFeatureEntitledBySnapshot(featureKey, snapshot));
}
