import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { publicApiError, publicApiJson } from "@/core/public-api/types";
import { withPublicApiRouteParams } from "@/core/public-api/with-public-api-route";
import { createAdminClient } from "@/core/supabase/admin";

export const GET = withPublicApiRouteParams(
  "public_api_appointments_get",
  "appointments:read",
  async (_request, { auth, traceId }, params) => {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("api_get_appointment", {
      p_clinic_id: auth.clinicId,
      p_appointment_id: params.id,
    });

    if (error) {
      return publicApiError(
        resolvePostgresUserMessage(error, { fallback: error.message }),
        500,
        traceId
      );
    }

    if (!data) {
      return publicApiError("Turno no encontrado", 404, traceId);
    }

    return publicApiJson(data, { traceId, clinicId: auth.clinicId });
  }
);
