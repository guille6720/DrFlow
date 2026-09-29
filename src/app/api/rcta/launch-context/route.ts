import { NextResponse } from "next/server";

import { withObservabilityApiRoute } from "@/core/observability/api-route";

import { loadRctaLaunchContext } from "@/lib/integrations/rcta/launch-context.server";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

/**
 * Read-only GET (not a server action): router navigations/refreshes on the patient workspace can leave
 * pending server actions unresolved, so the RCTA card loads its context through this route instead.
 */
export const GET = withObservabilityApiRoute("rcta_launch_context", async (request) => {
  const patientId = new URL(request.url).searchParams.get("patientId") ?? "";
  const result = await loadRctaLaunchContext(patientId);
  const status = !result.ok && result.reason === "unauthenticated" ? 401 : 200;
  return NextResponse.json(result, { status, headers: NO_STORE });
});
