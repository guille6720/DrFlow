import { loadPublicApiAvailability } from "@/core/public-api/load-availability";
import { publicApiError, publicApiJson } from "@/core/public-api/types";
import { withPublicApiRoute } from "@/core/public-api/with-public-api-route";
import { firstZodIssue } from "@/core/validations/params";
import { apiAvailabilityQuerySchema } from "@/core/validations/public-api-schemas";

export const GET = withPublicApiRoute(
  "public_api_availability",
  "appointments:read",
  async (request, { auth, traceId }) => {
    const url = new URL(request.url);
    const parsed = apiAvailabilityQuerySchema.safeParse({
      professional_id: url.searchParams.get("professional_id"),
      days_ahead: url.searchParams.get("days_ahead") ?? undefined,
    });

    if (!parsed.success) {
      return publicApiError(firstZodIssue(parsed.error), 400, traceId);
    }

    const { slots } = await loadPublicApiAvailability(
      auth.clinicId,
      parsed.data.professional_id,
      parsed.data.days_ahead ?? 21
    );

    return publicApiJson({ slots }, { traceId, clinicId: auth.clinicId });
  }
);
