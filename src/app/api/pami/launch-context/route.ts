import { NextResponse } from "next/server";

import { withObservabilityApiRoute } from "@/core/observability/api-route";

import { loadPamiLaunchContext } from "@/lib/integrations/pami/launch-context.server";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

/** Read-only GET (not a server action), same reasoning as `/api/rcta/launch-context`. */
export const GET = withObservabilityApiRoute("pami_launch_context", async (request) => {
  const patientId = new URL(request.url).searchParams.get("patientId") ?? "";
  const result = await loadPamiLaunchContext(patientId);
  const status = !result.ok && result.reason === "unauthenticated" ? 401 : 200;
  return NextResponse.json(result, { status, headers: NO_STORE });
});
