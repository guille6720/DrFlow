"use client";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { FEATURES } from "@/core/entitlements/features";

/** Shown on operational reports when BI is not in the commercial plan. */
export function ReportesBiUpsell() {
  return <AddonUpgradeNotice feature={FEATURES.ADVANCED_REPORTS} />;
}
