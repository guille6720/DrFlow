import { NextResponse } from "next/server";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { authorizeCronRequest } from "@/core/observability/cron-auth";

export const dynamic = "force-dynamic";

/** Purge observability events older than 30 days (cron GET). */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasAdminClient()) {
    return NextResponse.json({ ok: false, error: "Admin client unavailable" }, { status: 503 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("purge_old_observability_events", { p_days: 30 });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: data ?? 0 });
}

export async function POST(request: Request) {
  return GET(request);
}
