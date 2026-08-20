import type { FeatureLimit } from "@/core/entitlements/types";

export type CommercialQuotaRow = {
  label: string;
  value: string;
};

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
