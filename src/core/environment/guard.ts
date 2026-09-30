import { NextResponse } from "next/server";

import { getEnvironmentIsolation, type IsolationReport } from "@/core/environment/runtime";

/** Status probes stay reachable so operators can see WHY the deployment is locked (codes only). */
const PROBE_PATHS = new Set(["/api/health", "/api/health/live", "/api/health/ready", "/api/version"]);

let cached: IsolationReport | null = null;

/** Env is fixed per deployment, so the evaluation is computed once per instance. */
export function getCachedIsolation(): IsolationReport {
  cached ??= getEnvironmentIsolation();
  return cached;
}

export function resetCachedIsolationForTests(): void {
  cached = null;
}

/**
 * Fail-closed gate used by the middleware. When the environment contract is broken (e.g. staging code wired to
 * the production database) every page, API route, server action and cron is refused with 503 before any
 * Supabase client is created.
 */
export function environmentLockResponse(pathname: string, report = getCachedIsolation()): NextResponse | null {
  if (report.ok || PROBE_PATHS.has(pathname)) return null;
  const body = {
    error: "environment_isolation_failed",
    message: "Entorno mal configurado: la aplicación está bloqueada para proteger los datos.",
    codes: report.errors,
  };
  return NextResponse.json(body, { status: 503, headers: { "Cache-Control": "no-store" } });
}
