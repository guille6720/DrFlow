import type { PamiLaunchContextResult } from "@/lib/integrations/pami/types";
import type { RctaLaunchContextResult } from "@/lib/integrations/rcta/types";

const DENIED = { ok: false, reason: "not_allowed" } as const;

async function fetchContext<T>(path: string): Promise<T | typeof DENIED> {
  try {
    const res = await fetch(path, { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return DENIED;
    return (await res.json()) as T;
  } catch {
    return DENIED;
  }
}

/** Same-origin NexClinic routes only; access is resolved server-side from the session. */
export function fetchRctaLaunchContext(patientId: string) {
  return fetchContext<RctaLaunchContextResult>(`/api/rcta/launch-context?patientId=${encodeURIComponent(patientId)}`);
}

export function fetchPamiLaunchContext(patientId: string) {
  return fetchContext<PamiLaunchContextResult>(`/api/pami/launch-context?patientId=${encodeURIComponent(patientId)}`);
}
