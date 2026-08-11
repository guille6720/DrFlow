import { publicApiJson } from "@/core/public-api/types";
import { withPublicApiRoute } from "@/core/public-api/with-public-api-route";
import { createAdminClient } from "@/core/supabase/admin";

export const GET = withPublicApiRoute(
  "public_api_professionals_list",
  "professionals:read",
  async (_request, { auth, traceId }) => {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("api_list_professionals", {
      p_clinic_id: auth.clinicId,
    });

    if (error) {
      return publicApiJson({ error: error.message }, { status: 500, traceId, clinicId: auth.clinicId });
    }

    return publicApiJson(data ?? [], { traceId, clinicId: auth.clinicId });
  }
);
