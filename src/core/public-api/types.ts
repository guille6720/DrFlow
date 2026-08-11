export const PUBLIC_API_SCOPES = [
  "appointments:read",
  "appointments:write",
  "professionals:read",
] as const;

export type PublicApiScope = (typeof PUBLIC_API_SCOPES)[number];

export type PublicApiAuthContext = {
  keyId: string;
  clinicId: string;
  scopes: string[];
  keyName: string;
};

export function hasPublicApiScope(scopes: string[], required: PublicApiScope): boolean {
  return scopes.includes(required);
}

export function publicApiJson(
  data: unknown,
  init?: { status?: number; traceId?: string; clinicId?: string }
): Response {
  return Response.json(
    {
      data,
      meta: {
        clinic_id: init?.clinicId ?? null,
        trace_id: init?.traceId ?? null,
      },
    },
    {
      status: init?.status ?? 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export function publicApiError(
  message: string,
  status: number,
  traceId?: string
): Response {
  return Response.json(
    { error: message, meta: { trace_id: traceId ?? null } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}
