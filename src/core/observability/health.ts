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
    env?: {
      publishableKeyConfigured: boolean;
      serviceRoleConfigured: boolean;
    };
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();

  if (!url) {
    return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL missing" };
  }
  if (!publishableKey || publishableKey.includes("placeholder")) {
    return { ok: false, error: "Supabase publishable/anon key missing or placeholder" };
  }

  const start = performance.now();
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      method: "HEAD",
      headers: { apikey: publishableKey },
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

function probePublicEnv(): NonNullable<PublicHealthStatus["checks"]["env"]> {
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  return {
    publishableKeyConfigured: Boolean(publishableKey && !publishableKey.includes("placeholder")),
    serviceRoleConfigured: hasAdminClient(),
  };
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
    const { error: clinicsError } = await supabase
      .from("clinics")
      .select("id, is_fiscalization")
      .limit(1);
    if (clinicsError) {
      return { ok: false, error: "schema_probe_failed" };
    }
    const { count, error: dxError } = await supabase
      .from("clinical_diagnoses")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    if (dxError) {
      return { ok: false, error: "clinical_diagnoses_unavailable" };
    }
    if ((count ?? 0) < 1) {
      return { ok: false, error: "clinical_diagnoses_empty" };
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
  const envCheck = probePublicEnv();
  const ok =
    supabaseCheck.ok &&
    envCheck.publishableKeyConfigured &&
    heapUsedMb < 512 &&
    (schemaCheck ? schemaCheck.ok : true);

  return {
    ok,
    version: release.version,
    buildId: release.buildId,
    timestamp: new Date().toISOString(),
    checks: {
      supabase: supabaseCheck,
      memory: { ok: heapUsedMb < 512 },
      env: envCheck,
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
