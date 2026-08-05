import { NextResponse } from "next/server";

import { getReleasePayload } from "@/core/app-release";

export const dynamic = "force-dynamic";

/** Liveness — process is running (K8s / load balancer). Always 200 if Node responds. */
export async function GET() {
  const release = getReleasePayload();
  return NextResponse.json(
    {
      ok: true,
      probe: "live",
      version: release.version,
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
