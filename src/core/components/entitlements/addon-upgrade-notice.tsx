"use client";

import Link from "next/link";

import { useCanUseFeature } from "@/core/components/entitlements/entitlements-provider";
import { isFeatureEnforced } from "@/core/entitlements/enforcement";
import { commercialFeatureLabel } from "@/core/entitlements/feature-labels";
import type { FeatureKey } from "@/core/entitlements/features";

export function AddonUpgradeNotice({ feature }: { feature: FeatureKey }) {
  const entitled = useCanUseFeature(feature);
  if (!isFeatureEnforced(feature) || entitled) return null;

  const label = commercialFeatureLabel(feature);

  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <strong>{label}</strong> no está incluido en tu plan comercial.{" "}
      <Link href={`/planes?modulo=${encodeURIComponent(feature)}`} className="font-medium text-teal-800 underline">
        Ver planes
      </Link>
      {" · "}
      <Link href="/configuracion" className="font-medium text-teal-800 underline">
        Tu plan
      </Link>
    </p>
  );
}
