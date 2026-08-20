import { commercialFeatureLabel } from "@/core/entitlements/feature-labels";
import type { FeatureKey } from "@/core/entitlements/features";

export type PlanFeatureSnapshot = {
  key: FeatureKey | string;
  enabled: boolean;
  value: number | null;
};

export type PlanDiff = {
  currentPlanKey: string;
  newPlanKey: string;
  featuresGained: string[];
  featuresLost: string[];
  limitsIncreased: string[];
  limitsDecreased: string[];
  isDowngrade: boolean;
};

function label(key: string): string {
  try {
    return commercialFeatureLabel(key as FeatureKey);
  } catch {
    return key;
  }
}

/** Compare two plan feature maps (from plan_features). No hardcoded matrix. */
export function diffPlanFeatures(
  currentPlanKey: string,
  newPlanKey: string,
  currentFeatures: PlanFeatureSnapshot[],
  newFeatures: PlanFeatureSnapshot[]
): PlanDiff {
  const cur = new Map(currentFeatures.map((f) => [f.key, f]));
  const next = new Map(newFeatures.map((f) => [f.key, f]));
  const keys = new Set([...cur.keys(), ...next.keys()]);

  const featuresGained: string[] = [];
  const featuresLost: string[] = [];
  const limitsIncreased: string[] = [];
  const limitsDecreased: string[] = [];
  let lostCount = 0;
  let gainedCount = 0;

  for (const key of keys) {
    const a = cur.get(key);
    const b = next.get(key);
    const aOn = a?.enabled === true;
    const bOn = b?.enabled === true;
    if (!aOn && bOn) {
      featuresGained.push(label(key));
      gainedCount += 1;
    }
    if (aOn && !bOn) {
      featuresLost.push(label(key));
      lostCount += 1;
    }
    const av = a?.value ?? null;
    const bv = b?.value ?? null;
    if (aOn && bOn) {
      if (av !== null && bv !== null) {
        if (bv > av) limitsIncreased.push(`${label(key)}: ${av} → ${bv}`);
        if (bv < av) limitsDecreased.push(`${label(key)}: ${av} → ${bv}`);
      } else if (av !== null && bv === null) {
        limitsIncreased.push(`${label(key)}: ${av} → ilimitado`);
      } else if (av === null && bv !== null) {
        limitsDecreased.push(`${label(key)}: ilimitado → ${bv}`);
      }
    }
  }

  return {
    currentPlanKey,
    newPlanKey,
    featuresGained,
    featuresLost,
    limitsIncreased,
    limitsDecreased,
    isDowngrade: lostCount > gainedCount || limitsDecreased.length > limitsIncreased.length,
  };
}
