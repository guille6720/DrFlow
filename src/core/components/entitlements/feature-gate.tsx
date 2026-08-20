"use client";

import type { ReactNode } from "react";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import {
  useCanUseFeature,
  useFeatureQuotaLabel,
} from "@/core/components/entitlements/entitlements-provider";
import { isFeatureEnforced } from "@/core/entitlements/enforcement";
import type { FeatureKey } from "@/core/entitlements/features";

/**
 * UX-only gate. Not a security boundary — server APIs must call requireFeature.
 * Core clinical features are never hidden.
 * Missing catalog (migration not applied) fails open.
 * Pass fallback={null} to hide without an upgrade notice.
 */
export function FeatureGate({
  feature,
  allowed,
  fallback,
  showQuota = false,
  children,
}: {
  feature: FeatureKey;
  allowed?: boolean;
  fallback?: ReactNode;
  showQuota?: boolean;
  children: ReactNode;
}) {
  const entitled = useCanUseFeature(feature);
  const quota = useFeatureQuotaLabel(feature);
  const deniedFallback = fallback === undefined ? <AddonUpgradeNotice feature={feature} /> : fallback;

  if (!isFeatureEnforced(feature)) return children;
  if (allowed === false) return deniedFallback;
  const visible = allowed === true || entitled;
  if (!visible) return deniedFallback;

  return (
    <>
      {showQuota && quota ? <p className="text-xs text-slate-500">Uso del plan: {quota}</p> : null}
      {children}
    </>
  );
}
