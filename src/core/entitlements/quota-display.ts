import type {
  FeatureLimit,
  ResolvedFeatureEntitlement,
} from "@/core/entitlements/types";

export type CommercialQuotaRow = {
  label: string;
  value: string;
};

/**
 * Prefer null (unlimited) over `?? 0`, which wrongly turns unlimited into "no incluido".
 */
export function resolvedFeatureLimit(
  resolved: ResolvedFeatureEntitlement | undefined
): FeatureLimit {
  if (!resolved) return 0;
  return resolved.limit;
}

/** Patient quota label — unlimited Premium (and peers) show the product copy. */
export function formatPatientQuotaLabel(amount: number, limit: FeatureLimit): string {
  if (limit === null) return "Pacientes ilimitados";
  if (limit === 0) return "no incluido";
  return `${amount} / ${limit}`;
}

export function formatQuotaLabel(amount: number, limit: FeatureLimit): string {
  if (limit === null) return `${amount} / ilimitado`;
  if (limit === 0) return "no incluido";
  return `${amount} / ${limit}`;
}

export function shouldAllowPatientCreate(headroom: number | null): boolean {
  return headroom === null || headroom > 0;
}

/** Fail-open when headroom is unknown. `adding === null` only blocks at cap. */
export function shouldAllowBulkPatientCreate(
  headroom: number | null,
  adding: number | null
): boolean {
  if (headroom === null) return true;
  if (adding === null) return headroom > 0;
  if (adding <= 0) return true;
  return headroom >= adding;
}

export function consumePatientCreateHeadroom(
  headroom: number | null,
  created: boolean
): number | null {
  if (headroom === null || !created) return headroom;
  return Math.max(0, headroom - 1);
}
