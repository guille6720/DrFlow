import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createTraceId } from "@/core/observability/trace-id";
import {
  inferStatusFromDuration,
  thresholdForCategory,
  type ObservabilityEventInput,
  type ObservabilityStatus,
} from "@/core/observability/types";

export { createTraceId };

function resolveClient(): SupabaseClient | null {
  try {
    if (hasAdminClient()) return createAdminClient();
  } catch {
    // fall through
  }
  return null;
}

async function resolveClientAsync(): Promise<SupabaseClient | null> {
  const admin = resolveClient();
  if (admin) return admin;
  try {
    const { createClient } = await import("@/core/supabase/server");
    return await createClient();
  } catch {
    return null;
  }
}

export async function recordObservabilityEvent(input: ObservabilityEventInput): Promise<void> {
  const durationMs = input.durationMs;
  let status: ObservabilityStatus = input.status ?? "ok";

  if (!input.status && durationMs !== undefined) {
    status = inferStatusFromDuration(
      durationMs,
      thresholdForCategory(input.category),
      input.category
    );
  }

  const payload = {
    clinic_id: input.clinicId ?? null,
    category: input.category,
    name: input.name,
    status,
    path: input.path ?? null,
    duration_ms: durationMs ?? null,
    trace_id: input.traceId ?? null,
    metadata: input.metadata ?? {},
    error_message: input.errorMessage ?? null,
  };

  if (status === "error") {
    console.error(
      `[obs:${input.category}] ${input.name}`,
      JSON.stringify({
        status,
        durationMs,
        path: input.path,
        traceId: input.traceId,
        error: input.errorMessage,
      })
    );
  } else if (status === "warn") {
    console.warn(
      `[obs:${input.category}] ${input.name}`,
      JSON.stringify({
        status,
        durationMs,
        path: input.path,
        traceId: input.traceId,
        error: input.errorMessage,
      })
    );
  }

  const supabase = await resolveClientAsync();
  if (!supabase) return;

  try {
    await supabase.from("clinic_observability_events").insert(payload);
  } catch (err) {
    console.error("[observability] failed to persist event", err);
  }
}

export async function withObservabilityTiming<T>(
  input: Omit<ObservabilityEventInput, "durationMs" | "status"> & {
    onlyIfSlow?: boolean;
  },
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  const traceId = input.traceId ?? createTraceId();

  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    const threshold = thresholdForCategory(input.category);
    const slow = durationMs >= threshold;

    if (!input.onlyIfSlow || slow) {
      void recordObservabilityEvent({
        ...input,
        traceId,
        durationMs,
        status: slow ? (durationMs >= threshold * 2 ? "error" : "warn") : "ok",
      });
    }

    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    void recordObservabilityEvent({
      ...input,
      traceId,
      durationMs,
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
    throw err;
  }
}
