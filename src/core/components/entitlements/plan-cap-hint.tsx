"use client";

import Link from "next/link";

import { useEntitlementsSnapshot } from "@/core/components/entitlements/entitlements-provider";
import { commercialFeatureLabel } from "@/core/entitlements/feature-labels";
import { type FeatureKey, FEATURES, isLimitFeature } from "@/core/entitlements/features";

/** Point-of-use plan cap (seats/storage). Hidden when catalog missing or unlimited. */
export function PlanCapHint({
  feature,
  label,
}: {
  feature: FeatureKey;
  label?: string;
}) {
  const snapshot = useEntitlementsSnapshot();
  if (!snapshot?.catalogAvailable) return null;
  if (!isLimitFeature(feature)) return null;
  const limit = snapshot.limits[feature];
  if (limit === undefined || limit === null) return null;

  const title = label ?? commercialFeatureLabel(feature);
  const unit = feature === FEATURES.STORAGE_MAX_MB ? " MB" : "";
  const cap = limit === 0 ? "no incluido en el plan" : `hasta ${limit}${unit}`;

  return (
    <p className="mb-3 text-xs text-slate-500">
      {title}: {cap}.{" "}
      <Link href="/configuracion" className="font-medium text-teal-800 underline">
        Tu plan
      </Link>
    </p>
  );
}
