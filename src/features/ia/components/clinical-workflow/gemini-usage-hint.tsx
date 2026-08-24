"use client";

import { EntitlementUsageHint } from "@/core/components/entitlements/entitlement-usage-hint";
import { useCanUseFeature } from "@/core/components/entitlements/entitlements-provider";
import { FEATURES } from "@/core/entitlements/features";

export function GeminiUsageHint() {
  const entitled = useCanUseFeature(FEATURES.AI);
  if (!entitled) return null;
  return (
    <EntitlementUsageHint feature={FEATURES.AI_MONTHLY_REQUESTS} label="Uso de IA este mes" />
  );
}
