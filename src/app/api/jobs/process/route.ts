import { NextResponse } from "next/server";
import { z } from "zod";

import { logServerError } from "@/core/errors/log-error.server";
import { processPendingClinicJobs } from "@/core/jobs/process";
import { authorizeCronRequest } from "@/core/observability/cron-auth";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const jobLimitSchema = z.coerce.number().int().min(1).max(50).default(10);

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

async function runWorker(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const url = new URL(request.url);
  const limitParsed = jobLimitSchema.safeParse(url.searchParams.get("limit") ?? undefined);
  const limit = limitParsed.success ? limitParsed.data : 10;

  try {
    const result = await processPendingClinicJobs({ limit });
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    logServerError("api.jobs.process", err);
    const message = err instanceof Error ? err.message : "Worker error";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

/** Vercel Cron invokes GET — processes pending clinic jobs. */
export async function GET(request: Request) {
  return runWorker(request);
}

/** Manual trigger (e.g. ops scripts). */
export async function POST(request: Request) {
  return runWorker(request);
}
