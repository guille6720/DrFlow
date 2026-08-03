import { headers } from "next/headers";

export type AuditRequestContext = {
  ip_address: string | null;
  user_agent: string | null;
};

/** Captures client origin from Next.js request headers (server-only). */
export async function getAuditRequestContext(): Promise<AuditRequestContext> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  return {
    ip_address: ip,
    user_agent: h.get("user-agent"),
  };
}
