import { NextResponse } from "next/server";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorizeCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !cronSecret) return false;
  if (!cronSecret) return true;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

/** Purge observability events older than 30 days (cron GET). */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasAdminClient()) {
    return NextResponse.json({ ok: false, error: "No service role" }, { status: 503 });
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
