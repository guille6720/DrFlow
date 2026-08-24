/** Centralized commercial usage thresholds (percent of effective limit). */
export type UsageThresholds = {
  infoPct: number;
  warnPct: number;
  criticalPct: number;
};

export const DEFAULT_USAGE_THRESHOLDS: UsageThresholds = {
  infoPct: 70,
  warnPct: 85,
  criticalPct: 100,
};

export type UsageBand = "normal" | "info" | "warning" | "critical" | "exceeded" | "unlimited";

export function usagePercentage(usage: number, limit: number | null | undefined): number | null {
  if (limit === null || limit === undefined) return null;
  if (limit <= 0) return usage > 0 ? 100 : 0;
  return Math.round((usage / limit) * 1000) / 10;
}

export function classifyUsageBand(
  usage: number,
  limit: number | null | undefined,
  thresholds: UsageThresholds = DEFAULT_USAGE_THRESHOLDS
): UsageBand {
  if (limit === null || limit === undefined) return "unlimited";
  if (limit <= 0) return usage > 0 ? "exceeded" : "critical";
  const pct = (usage / limit) * 100;
  if (pct > thresholds.criticalPct) return "exceeded";
  if (pct >= thresholds.criticalPct) return "critical";
  if (pct >= thresholds.warnPct) return "warning";
  if (pct >= thresholds.infoPct) return "info";
  return "normal";
}

export function remainingUsage(usage: number, limit: number | null | undefined): number | null {
  if (limit === null || limit === undefined) return null;
  return Math.max(0, limit - usage);
}
