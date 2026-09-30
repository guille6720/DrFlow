import { getReleasePayload } from "@/core/app-release";
import { type AppEnvironment, getEnvironmentIsolation } from "@/core/environment/runtime";
import {
  alertOnDbUnavailable,
  alertOnReadinessFailure,
} from "@/core/observability/ops-alert";
import { sanitizeMonitoringPayload } from "@/core/observability/sanitize-monitoring-payload";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { toJson } from "@/core/supabase/json";

export type HealthDatabaseStatus = "connected" | "unreachable" | "not_configured" | "blocked_by_isolation";

export type PublicHealthStatus = {
  ok: boolean;
  status: "ok" | "degraded" | "locked";
  environment: AppEnvironment | "unknown";
  version: string;
  buildId?: string;
  commit: string | null;
  database: HealthDatabaseStatus;
  /** Error codes only — never refs, URLs or key material. */
  environmentIsolation: { ok: boolean; errors: string[] };
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

const SKIPPED_BY_ISOLATION = { ok: false, error: "skipped_environment_isolation_failed" } as const;

function databaseStatus(
  isolationOk: boolean,
  supabase: PublicHealthStatus["checks"]["supabase"]
): HealthDatabaseStatus {
  if (!isolationOk) return "blocked_by_isolation";
  if (supabase.ok) return "connected";
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ? "unreachable" : "not_configured";
}

function releaseIdentity() {
  const release = getReleasePayload();
  const isolation = getEnvironmentIsolation();
  return {
    release,
    isolation,
    identity: {
      environment: isolation.environment,
      version: release.version,
      buildId: release.buildId,
      commit: release.commit,
      environmentIsolation: { ok: isolation.ok, errors: isolation.errors },
    },
  };
}

function overallStatus(isolationOk: boolean, ok: boolean): PublicHealthStatus["status"] {
  if (!isolationOk) return "locked";
  return ok ? "ok" : "degraded";
}

/** Public probe — no infra secrets or heap details. Never probes a database the isolation layer rejected. */
export async function getPublicHealthStatus(options?: {
  includeSchema?: boolean;
}): Promise<PublicHealthStatus> {
  const { isolation, identity } = releaseIdentity();
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const supabaseCheck = isolation.ok ? await probeSupabase() : SKIPPED_BY_ISOLATION;
  const schemaCheck =
    options?.includeSchema && isolation.ok ? await probeSchemaCompatibility() : undefined;
  const envCheck = probePublicEnv();
  const ok =
    isolation.ok &&
    supabaseCheck.ok &&
    envCheck.publishableKeyConfigured &&
    heapUsedMb < 512 &&
    (schemaCheck ? schemaCheck.ok : true);

  return {
    ok,
    status: overallStatus(isolation.ok, ok),
    ...identity,
    database: databaseStatus(isolation.ok, supabaseCheck),
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
  const { isolation, identity } = releaseIdentity();
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const supabaseCheck = isolation.ok ? await probeSupabase() : SKIPPED_BY_ISOLATION;
  const schemaCheck = isolation.ok ? await probeSchemaCompatibility() : SKIPPED_BY_ISOLATION;
  const ok = isolation.ok && supabaseCheck.ok && heapUsedMb < 512 && schemaCheck.ok;

  return {
    ok,
    status: overallStatus(isolation.ok, ok),
    ...identity,
    database: databaseStatus(isolation.ok, supabaseCheck),
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

  if (!status.ok) {
    if (!status.checks.supabase.ok) {
      alertOnDbUnavailable({
        error: status.checks.supabase.error ?? "supabase_probe_failed",
      });
    }
    alertOnReadinessFailure({
      checks: sanitizeMonitoringPayload({
        supabase: status.checks.supabase,
        schema: status.checks.schema,
        memory: { ok: status.checks.memory.ok },
      }) as Record<string, unknown>,
    });
  }

  if (hasAdminClient() && status.environmentIsolation.ok) {
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
