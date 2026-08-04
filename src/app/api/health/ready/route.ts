import { NextResponse } from "next/server";
import { getHealthStatus } from "@/core/observability/health";
import { validateProductionEnv } from "@/core/env.server";

export const dynamic = "force-dynamic";

/** Readiness — dependencies ready (Supabase, memory, prod env). Returns 503 when not ready. */
export async function GET() {
  const envCheck =
    process.env.NODE_ENV === "production"
      ? validateProductionEnv({ throwOnError: false })
      : { ok: true, environment: process.env.NODE_ENV ?? "development", missing: [], warnings: [] };

  const status = await getHealthStatus();
  const ready = status.ok && envCheck.ok;

  return NextResponse.json(
    {
      ok: ready,
      probe: "ready",
      version: status.version,
      timestamp: status.timestamp,
      checks: status.checks,
      env: envCheck,
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
