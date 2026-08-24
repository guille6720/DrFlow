import "server-only";

import { canUseFeatureAsSystem } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { authenticatePublicApiKey } from "@/core/public-api/auth";
import { checkPublicApiRateLimit } from "@/core/public-api/rate-limit";
import type { PublicApiAuthContext, PublicApiScope } from "@/core/public-api/types";
import { hasPublicApiScope, publicApiError } from "@/core/public-api/types";

export type PublicApiContext = {
  auth: PublicApiAuthContext;
  traceId: string;
};

type Handler = (request: Request, ctx: PublicApiContext) => Promise<Response>;

async function runPublicApiAuth(
  request: Request,
  obsCtx: { traceId: string; clinicId?: string | null },
  requiredScope: PublicApiScope
): Promise<
  { ok: true; ctx: PublicApiContext } | { ok: false; response: Response }
> {
  const authResult = await authenticatePublicApiKey(request);
  if (!authResult.ok) {
    return {
      ok: false,
      response: publicApiError(authResult.message, authResult.status, obsCtx.traceId),
    };
  }

  const { auth } = authResult;
  obsCtx.clinicId = auth.clinicId;

  if (!(await canUseFeatureAsSystem({ clinicId: auth.clinicId, featureKey: FEATURES.API }))) {
    return {
      ok: false,
      response: publicApiError(
        "La API pública no está incluida en el plan del consultorio.",
        403,
        obsCtx.traceId
      ),
    };
  }

  if (!checkPublicApiRateLimit(auth.keyId)) {
    return {
      ok: false,
      response: publicApiError("Rate limit excedido (120 req/min)", 429, obsCtx.traceId),
    };
  }

  if (!hasPublicApiScope(auth.scopes, requiredScope)) {
    return {
      ok: false,
      response: publicApiError(`Scope requerido: ${requiredScope}`, 403, obsCtx.traceId),
    };
  }

  return { ok: true, ctx: { auth, traceId: obsCtx.traceId } };
}

export function withPublicApiRoute(name: string, requiredScope: PublicApiScope, handler: Handler) {
  return withObservabilityApiRoute(name, async (request, obsCtx) => {
    const gate = await runPublicApiAuth(request, obsCtx, requiredScope);
    if (!gate.ok) return gate.response;
    return handler(request, gate.ctx);
  });
}

export function withPublicApiRouteParams<T extends Record<string, string>>(
  name: string,
  requiredScope: PublicApiScope,
  handler: (request: Request, ctx: PublicApiContext, params: T) => Promise<Response>
) {
  return (
    request: Request,
    routeCtx: { params: Promise<T> }
  ) =>
    withObservabilityApiRoute(name, async (req, obsCtx) => {
      const gate = await runPublicApiAuth(req, obsCtx, requiredScope);
      if (!gate.ok) return gate.response;
      const params = await routeCtx.params;
      return handler(req, gate.ctx, params);
    })(request);
}
