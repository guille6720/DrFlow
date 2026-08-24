import { isFeatureEnforced } from "@/core/entitlements/enforcement";
import type { FeatureKey } from "@/core/entitlements/features";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

/** UX fail-open: missing catalog or unenforced keys stay available. */
export function isFeatureEntitledBySnapshot(
  featureKey: FeatureKey | null | undefined,
  snapshot: ClientEntitlementsSnapshot | null
): boolean {
  if (!featureKey) return true;
  if (!isFeatureEnforced(featureKey)) return true;
  if (!snapshot?.catalogAvailable) return true;
  return snapshot.allowed[featureKey] === true;
}
