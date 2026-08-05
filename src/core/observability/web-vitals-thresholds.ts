import type { ObservabilityStatus } from "@/core/observability/types";

/** Google Web Vitals thresholds (ms except CLS). */
export const WEB_VITAL_THRESHOLDS: Record<
  string,
  { warn: number; error: number; unit?: "ms" | "score" }
> = {
  LCP: { warn: 2500, error: 4000, unit: "ms" },
  INP: { warn: 200, error: 500, unit: "ms" },
  CLS: { warn: 0.1, error: 0.25, unit: "score" },
  FCP: { warn: 1800, error: 3000, unit: "ms" },
  TTFB: { warn: 800, error: 1800, unit: "ms" },
};

export function inferWebVitalStatus(name: string, value: number): ObservabilityStatus {
  const thresholds = WEB_VITAL_THRESHOLDS[name];
  if (!thresholds) return "ok";
  if (value >= thresholds.error) return "error";
  if (value >= thresholds.warn) return "warn";
  return "ok";
}
