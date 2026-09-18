import { NextResponse } from "next/server";

import { validateProductionEnv } from "@/core/env.server";
import { getPublicHealthStatus } from "@/core/observability/health";

export const dynamic = "force-dynamic";

/** Readiness — dependencies ready (Supabase, memory, schema, prod env). Returns 503 when not ready. */
export async function GET() {
  const envCheck =
    process.env.NODE_ENV === "production"
      ? validateProductionEnv({ throwOnError: false })
      : { ok: true, environment: process.env.NODE_ENV ?? "development", missing: [], warnings: [] };

  const status = await getPublicHealthStatus({ includeSchema: true });
  const ready = status.ok && envCheck.ok;

  return NextResponse.json(
    {
      ok: ready,
      probe: "ready",
      version: status.version,
      timestamp: status.timestamp,
      checks: status.checks,
      env: { ok: envCheck.ok },
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
