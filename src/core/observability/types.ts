/** Observability thresholds — Phase 16. */
export const SLOW_QUERY_MS = 500;
export const SLOW_REQUEST_MS = 2000;
export const SLOW_JOB_MS = 5000;

export type ObservabilityCategory = "error" | "performance" | "job" | "api" | "query";
export type ObservabilityStatus = "ok" | "warn" | "error";

export type ObservabilityEventInput = {
  clinicId?: string | null;
  category: ObservabilityCategory;
  name: string;
  status?: ObservabilityStatus;
  path?: string;
  durationMs?: number;
  traceId?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
};

export const CATEGORY_LABELS: Record<ObservabilityCategory, string> = {
  error: "Error",
  performance: "Performance",
  job: "Job",
  api: "API",
  query: "Query",
};

export const STATUS_LABELS: Record<ObservabilityStatus, string> = {
  ok: "OK",
  warn: "Advertencia",
  error: "Error",
};

export function inferStatusFromDuration(
  durationMs: number,
  warnMs: number,
  category: ObservabilityCategory
): ObservabilityStatus {
  if (category === "error") return "error";
  if (durationMs >= warnMs * 2) return "error";
  if (durationMs >= warnMs) return "warn";
  return "ok";
}

export function thresholdForCategory(category: ObservabilityCategory): number {
  switch (category) {
    case "job":
      return SLOW_JOB_MS;
    case "query":
      return SLOW_QUERY_MS;
    case "api":
    case "performance":
      return SLOW_REQUEST_MS;
    default:
      return SLOW_REQUEST_MS;
  }
}
