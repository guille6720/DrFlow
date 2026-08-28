import { NextResponse } from "next/server";

import { getActiveClinicId, getSession } from "@/core/auth/session.server";
import { clientObservabilityBatchSchema } from "@/core/observability/client-ingest-schema";
import { recordObservabilityEvent } from "@/core/observability/record";
import { sanitizeTelemetryMetadata } from "@/core/observability/sanitize-monitoring-payload";
import { inferWebVitalStatus } from "@/core/observability/web-vitals-thresholds";
import { requireSameOriginMutation } from "@/core/security/csrf";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

/** Client-side ingest for Web Vitals, page load, and client errors. */
export async function POST(request: Request) {
  const csrfBlock = requireSameOriginMutation(request);
  if (csrfBlock) return csrfBlock;

  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: NO_STORE });
  }

  const clinicId = await getActiveClinicId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: NO_STORE });
  }

  const parsed = clientObservabilityBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400, headers: NO_STORE });
  }

  const traceId = request.headers.get("x-drflow-trace-id");

  for (const event of parsed.data.events) {
    let status = event.status;
    if (!status && event.category === "performance" && event.durationMs != null) {
      const metric = event.metadata?.metric;
      if (typeof metric === "string") {
        status = inferWebVitalStatus(metric, event.durationMs);
      }
    }

    void recordObservabilityEvent({
      clinicId,
      category: event.category,
      name: event.name,
      status: status ?? (event.category === "error" ? "error" : "ok"),
      path: event.path,
      durationMs: event.durationMs,
      traceId: event.traceId ?? traceId ?? undefined,
      metadata: sanitizeTelemetryMetadata(event.metadata),
      errorMessage: event.errorMessage,
    });
  }

  return NextResponse.json({ ok: true, accepted: parsed.data.events.length }, { headers: NO_STORE });
}
