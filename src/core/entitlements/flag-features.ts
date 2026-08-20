import { type FeatureKey, FEATURES } from "@/core/entitlements/features";
import { isFeatureEntitledBySnapshot } from "@/core/entitlements/snapshot-access";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

/** UX clinic flags that wrap a commercial add-on. Core flags stay ungated. */
export function addonFeatureForClinicFeatureFlag(flagId: string): FeatureKey | null {
  if (flagId === "consultation_assistant" || flagId === "admin_ops_assistant") {
    return FEATURES.AI;
  }
  if (flagId === "recordatorios") return FEATURES.WHATSAPP_REMINDERS;
  if (flagId === "public_booking_online") return FEATURES.PORTAL;
  return null;
}

/** Fail-open when the catalog is missing. */
export function isFlagEntitledBySnapshot(
  flagId: string,
  snapshot: ClientEntitlementsSnapshot | null
): boolean {
  return isFeatureEntitledBySnapshot(addonFeatureForClinicFeatureFlag(flagId), snapshot);
}
