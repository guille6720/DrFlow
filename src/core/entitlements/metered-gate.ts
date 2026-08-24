import { ADDON_SUSPENDED_MESSAGE } from "@/core/entitlements/commercial-status";

const QUOTA_MESSAGES: Record<string, string> = {
  QUOTA_EXCEEDED: "Se alcanzó el límite de uso del plan.",
  FEATURE_DISABLED: "Esta función no está incluida en el plan del consultorio.",
  COMMERCIAL_SUSPENDED: ADDON_SUSPENDED_MESSAGE,
};

export const AI_MONTHLY_QUOTA_MESSAGE = "Límite mensual de IA alcanzado";

export const USAGE_RPC_UNAVAILABLE = "USAGE_RPC_UNAVAILABLE";

export type MeteredUsageGateDecision = { ok: true } | { ok: false; error: string };

/** Fail open unless the catalog is live and the quota RPC explicitly denies. */
export function decideMeteredUsageGate(input: {
  enforced: boolean;
  catalogAvailable: boolean;
  rpcUnavailable: boolean;
  consumeOk: boolean;
  consumeError: string | null;
}): MeteredUsageGateDecision {
  if (!input.enforced) return { ok: true };
  if (!input.catalogAvailable) return { ok: true };
  if (input.rpcUnavailable) return { ok: true };
  if (input.consumeOk) return { ok: true };
  const code = input.consumeError ?? "";
  if (code === "QUOTA_EXCEEDED" || code === "FEATURE_DISABLED" || code === "COMMERCIAL_SUSPENDED") {
    return { ok: false, error: QUOTA_MESSAGES[code] };
  }
  return { ok: true };
}

export function isUsageRpcUnavailable(error: string | null | undefined): boolean {
  if (!error) return false;
  return (
    error === USAGE_RPC_UNAVAILABLE ||
    error === "USAGE_RPC_FAILED" ||
    error.includes("try_consume_feature_usage") ||
    error.includes("increment_feature_usage")
  );
}
