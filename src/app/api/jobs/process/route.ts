import { NextResponse } from "next/server";
import { processPendingClinicJobs } from "@/lib/jobs/process";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeWorker(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !cronSecret) return false;
  if (!cronSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

async function runWorker(request: Request) {
  if (!authorizeWorker(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 50);

  try {
    const result = await processPendingClinicJobs({ limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Worker error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
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
