import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import type { FeatureKey } from "@/core/entitlements/features";

/** Full-width upgrade card for add-on layouts. Prefer FeatureGate / AddonUpgradeNotice inline. */
export function FeatureUnavailable({ feature }: { feature: FeatureKey }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <AddonUpgradeNotice feature={feature} />
    </div>
  );
}
