import { getReleasePayload } from "@/core/app-release";
import { sanitizeMonitoringPayload } from "@/core/observability/sanitize-monitoring-payload";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { toJson } from "@/core/supabase/json";

export type PublicHealthStatus = {
  ok: boolean;
  version: string;
  buildId?: string;
  timestamp: string;
  checks: {
    supabase: { ok: boolean; latencyMs?: number; error?: string };
    memory: { ok: boolean };
    schema?: { ok: boolean; error?: string };
  };
};

export type InternalHealthStatus = PublicHealthStatus & {
  checks: PublicHealthStatus["checks"] & {
    memory: { ok: boolean; heapUsedMb: number; heapTotalMb: number };
    serviceRole: { configured: boolean };
  };
};

/** @deprecated Use InternalHealthStatus — kept for admin UI compatibility. */
export type HealthStatus = InternalHealthStatus;

async function probeSupabase(): Promise<PublicHealthStatus["checks"]["supabase"]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, error: "Not configured" };
  }

  const start = performance.now();
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
    const res = await fetch(`${url}/rest/v1/`, {
      method: "HEAD",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
      cache: "no-store",
    });
    return {
      ok: res.ok || res.status === 401,
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unreachable",
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

/**
 * Lightweight schema compatibility probe (Phase 3 fiscalization marker).
 * Uses service role only when configured; otherwise skips as ok=true.
 */
async function probeSchemaCompatibility(): Promise<{ ok: boolean; error?: string }> {
  if (!hasAdminClient()) {
    return { ok: true };
  }
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("clinics").select("id, is_fiscalization").limit(1);
    if (error) {
      return { ok: false, error: "schema_probe_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "schema_probe_failed" };
  }
}

/** Public probe — no infra secrets or heap details. */
export async function getPublicHealthStatus(options?: {
  includeSchema?: boolean;
}): Promise<PublicHealthStatus> {
  const release = getReleasePayload();
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const supabaseCheck = await probeSupabase();
  const schemaCheck = options?.includeSchema ? await probeSchemaCompatibility() : undefined;
  const ok =
    supabaseCheck.ok && heapUsedMb < 512 && (schemaCheck ? schemaCheck.ok : true);

  return {
    ok,
    version: release.version,
    buildId: release.buildId,
    timestamp: new Date().toISOString(),
    checks: {
      supabase: supabaseCheck,
      memory: { ok: heapUsedMb < 512 },
      ...(schemaCheck ? { schema: schemaCheck } : {}),
    },
  };
}

/** Internal probe — admin dashboards and cron persistence only. */
export async function getHealthStatus(): Promise<InternalHealthStatus> {
  const release = getReleasePayload();
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const supabaseCheck = await probeSupabase();
  const schemaCheck = await probeSchemaCompatibility();
  const ok = supabaseCheck.ok && heapUsedMb < 512 && schemaCheck.ok;

  return {
    ok,
    version: release.version,
    buildId: release.buildId,
    timestamp: new Date().toISOString(),
    checks: {
      supabase: supabaseCheck,
      memory: { ok: heapUsedMb < 512, heapUsedMb, heapTotalMb },
      serviceRole: { configured: hasAdminClient() },
      schema: schemaCheck,
    },
  };
}

export async function recordHealthCheckEvent(): Promise<InternalHealthStatus> {
  const status = await getHealthStatus();

  if (hasAdminClient()) {
    const supabase = createAdminClient();
    await supabase.from("clinic_observability_events").insert({
      clinic_id: null,
      category: "api",
      name: "health_check",
      status: status.ok ? "ok" : "warn",
      path: "/api/health",
      duration_ms: status.checks.supabase.latencyMs ?? null,
      metadata: toJson(
        sanitizeMonitoringPayload({
          version: status.version,
          heapUsedMb: status.checks.memory.heapUsedMb,
          serviceRoleConfigured: status.checks.serviceRole.configured,
          schemaOk: status.checks.schema?.ok ?? null,
        })
      ),
    });
  }

  return status;
}
