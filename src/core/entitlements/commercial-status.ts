import type { EntitlementSubscriptionStatus } from "@/core/entitlements/types";

/** Trialing with a past trial_ends_at. NULL trial_ends_at means no window (still live). */
export function isLapsedCommercialTrial(
  status: EntitlementSubscriptionStatus | string | null | undefined,
  trialEndsAt?: string | null,
  now: Date = new Date()
): boolean {
  if (status !== "trialing" || !trialEndsAt) return false;
  const ends = Date.parse(trialEndsAt);
  if (Number.isNaN(ends)) return false;
  return ends <= now.getTime();
}

/** Superadmin-set commercial statuses that pause add-ons only. Lapsed trial counts as expired. */
export function isSuspendedCommercialStatus(
  status: EntitlementSubscriptionStatus | string | null | undefined,
  trialEndsAt?: string | null,
  now: Date = new Date()
): boolean {
  if (isLapsedCommercialTrial(status, trialEndsAt, now)) return true;
  return status === "past_due" || status === "cancelled" || status === "expired";
}

export function isLiveCommercialStatus(
  status: EntitlementSubscriptionStatus | string | null | undefined,
  trialEndsAt?: string | null,
  now: Date = new Date()
): boolean {
  if (status === "active") return true;
  if (status === "trialing") return !isLapsedCommercialTrial(status, trialEndsAt, now);
  return false;
}

export function effectiveCommercialStatus(
  status: EntitlementSubscriptionStatus | string | null | undefined,
  trialEndsAt?: string | null,
  now: Date = new Date()
): EntitlementSubscriptionStatus | string | null {
  if (isLapsedCommercialTrial(status, trialEndsAt, now)) return "expired";
  return status ?? null;
}

export const ADDON_SUSPENDED_MESSAGE =
  "El plan comercial está suspendido. El consultorio clínico sigue disponible.";

export function commercialStatusLabel(
  status: EntitlementSubscriptionStatus | string | null | undefined
): string | null {
  if (status === "past_due") return "vencido";
  if (status === "cancelled") return "cancelado";
  if (status === "expired") return "expirado";
  return null;
}

/** Matches SQL entitlement_metered_commercially_blocked: pause plan usage, keep override. */
export function isMeteredBlockedByCommercialStatus(
  status: EntitlementSubscriptionStatus | string | null | undefined,
  source: string | null | undefined,
  trialEndsAt?: string | null,
  now: Date = new Date()
): boolean {
  return isSuspendedCommercialStatus(status, trialEndsAt, now) && source !== "override";
}

/** Matches SQL clinic_current_entitlement_subscription_id: live first, then newest. */
export function pickCurrentEntitlementSubscription<
  T extends { status: string; createdAt: string; trialEndsAt?: string | null },
>(rows: readonly T[], now: Date = new Date()): T | null {
  if (rows.length === 0) return null;
  return (
    [...rows].sort((left, right) => {
      const liveRank =
        Number(isLiveCommercialStatus(left.status, left.trialEndsAt, now)) -
        Number(isLiveCommercialStatus(right.status, right.trialEndsAt, now));
      if (liveRank !== 0) return -liveRank;
      return right.createdAt.localeCompare(left.createdAt);
    })[0] ?? null
  );
}
