import type { FeatureKey } from "@/core/entitlements/features";
import type { FeatureLimit } from "@/core/entitlements/types";

export type SeatCapacityDecision = { ok: true } | { ok: false; error: string };

const SEAT_LIMIT_MESSAGES: Partial<Record<FeatureKey, string>> = {
  "users.max": "Alcanzaste el máximo de usuarios de tu plan.",
  "professionals.max": "Alcanzaste el máximo de profesionales de tu plan.",
  "patients.max": "Alcanzaste el máximo de pacientes de tu plan.",
  "automations.max_active": "Alcanzaste el máximo de automatizaciones activas de tu plan.",
};

export function decideSeatCapacity(input: {
  enforced: boolean;
  catalogAvailable: boolean;
  limit: FeatureLimit | undefined;
  currentCount: number;
  extra?: number;
  featureKey: FeatureKey;
}): SeatCapacityDecision {
  if (!input.enforced) return { ok: true };
  if (!input.catalogAvailable) return { ok: true };

  const extra = input.extra ?? 1;
  const limit = input.limit;
  if (limit === undefined || limit === null) return { ok: true };
  if (limit === 0) {
    return {
      ok: false,
      error: SEAT_LIMIT_MESSAGES[input.featureKey] ?? "Esta función no está incluida en el plan del consultorio.",
    };
  }
  if (input.currentCount + extra > limit) {
    return {
      ok: false,
      error: SEAT_LIMIT_MESSAGES[input.featureKey] ?? "Se alcanzó el límite del plan.",
    };
  }
  return { ok: true };
}

/** null = unlimited or fail-open (do not cap). */
export function remainingSeatHeadroom(
  catalogAvailable: boolean,
  enforced: boolean,
  limit: FeatureLimit | undefined,
  currentCount: number
): number | null {
  if (!enforced || !catalogAvailable) return null;
  if (limit === undefined || limit === null) return null;
  return Math.max(0, limit - currentCount);
}
