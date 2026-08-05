import type { SupabaseClient } from "@supabase/supabase-js";

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
    avgJobDurationMs: number | null;
  };
  recentEvents: ObservabilityEventRow[];
};

export async function loadObservabilitySnapshot(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ObservabilitySnapshot> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: dayRows } = await supabase
    .from("clinic_observability_events")
    .select("id, category, name, status, path, duration_ms, trace_id, error_message, created_at")
    .eq("clinic_id", clinicId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = dayRows ?? [];
  const jobDurations = rows
    .filter((r) => r.category === "job" && r.duration_ms != null)
    .map((r) => r.duration_ms as number);

  return {
    last24h: {
      errors: rows.filter((r) => r.status === "error").length,
      warnings: rows.filter((r) => r.status === "warn").length,
      slowQueries: rows.filter((r) => r.category === "query" && r.status !== "ok").length,
      slowJobs: rows.filter((r) => r.category === "job" && r.status !== "ok").length,
      avgJobDurationMs:
        jobDurations.length > 0
          ? Math.round(jobDurations.reduce((a, b) => a + b, 0) / jobDurations.length)
          : null,
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
