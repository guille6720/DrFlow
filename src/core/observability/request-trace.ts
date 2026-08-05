import "server-only";

import { headers } from "next/headers";

/** Reads trace id propagated by middleware (when inside a request). */
export async function getRequestTraceId(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-drflow-trace-id") ?? undefined;
  } catch {
    return undefined;
  }
}
