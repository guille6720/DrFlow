import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { getReleasePayload } from "@/core/app-release";

export type PublicHealthStatus = {
  ok: boolean;
  version: string;
  buildId?: string;
  timestamp: string;
  checks: {
    supabase: { ok: boolean; latencyMs?: number; error?: string };
    memory: { ok: boolean };
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

/** Public probe — no infra secrets or heap details. */
export async function getPublicHealthStatus(): Promise<PublicHealthStatus> {
  const release = getReleasePayload();
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const supabaseCheck = await probeSupabase();
  const ok = supabaseCheck.ok && heapUsedMb < 512;

  return {
    ok,
    version: release.version,
    buildId: release.buildId,
    timestamp: new Date().toISOString(),
    checks: {
      supabase: supabaseCheck,
      memory: { ok: heapUsedMb < 512 },
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
  const ok = supabaseCheck.ok && heapUsedMb < 512;

  return {
    ok,
    version: release.version,
    buildId: release.buildId,
    timestamp: new Date().toISOString(),
    checks: {
      supabase: supabaseCheck,
      memory: { ok: heapUsedMb < 512, heapUsedMb, heapTotalMb },
      serviceRole: { configured: hasAdminClient() },
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
      metadata: {
        version: status.version,
        heapUsedMb: status.checks.memory.heapUsedMb,
        serviceRole: status.checks.serviceRole.configured,
      },
    });
  }

  return status;
}
