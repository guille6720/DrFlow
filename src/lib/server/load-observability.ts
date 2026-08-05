import type { SupabaseClient } from "@supabase/supabase-js";

import { observeQuery } from "@/core/observability/observe-query";
import type { ObservabilityCategory, ObservabilityStatus } from "@/core/observability/types";

export type ObservabilityEventRow = {
  id: string;
  category: ObservabilityCategory;
  name: string;
  status: ObservabilityStatus;
  path: string | null;
  duration_ms: number | null;
  trace_id: string | null;
  error_message: string | null;
  created_at: string;
};

export type ObservabilitySnapshot = {
  last24h: {
    errors: number;
    warnings: number;
    slowQueries: number;
    slowJobs: number;
    slowApiRequests: number;
    webVitalsPoor: number;
    avgJobDurationMs: number | null;
    avgApiDurationMs: number | null;
    p75LcpMs: number | null;
  };
  recentEvents: ObservabilityEventRow[];
};

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? null;
}

export async function loadObservabilitySnapshot(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ObservabilitySnapshot> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const rows = await observeQuery(
    "load_observability_snapshot",
    clinicId,
    async () => {
      const { data, error } = await supabase
        .from("clinic_observability_events")
        .select("id, category, name, status, path, duration_ms, trace_id, error_message, created_at")
        .eq("clinic_id", clinicId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data ?? [];
    },
    "/configuracion/observabilidad"
  );
  const jobDurations = rows
    .filter((r) => r.category === "job" && r.duration_ms != null)
    .map((r) => r.duration_ms as number);
  const apiDurations = rows
    .filter((r) => r.category === "api" && r.duration_ms != null)
    .map((r) => r.duration_ms as number);
  const lcpValues = rows
    .filter((r) => r.name === "web_vital_lcp" && r.duration_ms != null)
    .map((r) => r.duration_ms as number);

  return {
    last24h: {
      errors: rows.filter((r) => r.status === "error").length,
      warnings: rows.filter((r) => r.status === "warn").length,
      slowQueries: rows.filter((r) => r.category === "query" && r.status !== "ok").length,
      slowJobs: rows.filter((r) => r.category === "job" && r.status !== "ok").length,
      slowApiRequests: rows.filter((r) => r.category === "api" && r.status !== "ok").length,
      webVitalsPoor: rows.filter(
        (r) => r.category === "performance" && r.name.startsWith("web_vital_") && r.status !== "ok"
      ).length,
      avgJobDurationMs:
        jobDurations.length > 0
          ? Math.round(jobDurations.reduce((a, b) => a + b, 0) / jobDurations.length)
          : null,
      avgApiDurationMs:
        apiDurations.length > 0
          ? Math.round(apiDurations.reduce((a, b) => a + b, 0) / apiDurations.length)
          : null,
      p75LcpMs: percentile(lcpValues, 75),
    },
    recentEvents: rows.slice(0, 25) as ObservabilityEventRow[],
  };
}

export async function getObservabilitySnapshot(clinicId: string): Promise<ObservabilitySnapshot | null> {
  const { createClient } = await import("@/core/supabase/server");
  const supabase = await createClient();
  return loadObservabilitySnapshot(supabase, clinicId);
}

export async function getObservabilityEvents(clinicId: string, limit = 25) {
  const { createClient } = await import("@/core/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_observability_events")
    .select("id, category, name, status, path, duration_ms, trace_id, error_message, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ObservabilityEventRow[];
}
