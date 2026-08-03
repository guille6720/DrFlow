import { NextResponse } from "next/server";
import { getHealthStatus, recordHealthCheckEvent } from "@/lib/observability/health";

export const dynamic = "force-dynamic";

/** Health check — latency, memory, Supabase connectivity. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const persist = url.searchParams.get("persist") === "1";

  const status = persist ? await recordHealthCheckEvent() : await getHealthStatus();

  return NextResponse.json(status, {
    status: status.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
