"use client";

import { useFeatureQuotaLabel } from "@/core/components/entitlements/entitlements-provider";
import type { FeatureKey } from "@/core/entitlements/features";

export function EntitlementUsageHint({
  feature,
  label,
}: {
  feature: FeatureKey;
  label: string;
}) {
  const quota = useFeatureQuotaLabel(feature);
  if (!quota) return null;
  return <p className="mb-3 text-xs text-slate-500">{label}: {quota}</p>;
}
