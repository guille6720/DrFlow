import { NextResponse } from "next/server";

import { authorizeCronRequest } from "@/core/observability/cron-auth";
import { getPublicHealthStatus, recordHealthCheckEvent } from "@/core/observability/health";

export const dynamic = "force-dynamic";

/** Health check — latency, memory, Supabase connectivity. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const persist = url.searchParams.get("persist") === "1";

  if (persist && !authorizeCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = persist ? await recordHealthCheckEvent() : await getPublicHealthStatus();

  return NextResponse.json(status, {
    status: status.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
