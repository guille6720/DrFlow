import { NextResponse } from "next/server";

import { authorizeCronRequest } from "@/core/observability/cron-auth";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

/** Purge observability events older than 30 days (cron GET). */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  if (!hasAdminClient()) {
    return NextResponse.json({ ok: false, error: "Admin client unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("purge_old_observability_events", { p_days: 30 });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ ok: true, deleted: data ?? 0 }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  return GET(request);
}
