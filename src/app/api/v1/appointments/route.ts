import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { publicApiError, publicApiJson } from "@/core/public-api/types";
import { withPublicApiRoute } from "@/core/public-api/with-public-api-route";
import { createAdminClient } from "@/core/supabase/admin";
import { firstZodIssue } from "@/core/validations/params";
import {
  apiCreateAppointmentSchema,
  apiListAppointmentsQuerySchema,
} from "@/core/validations/public-api-schemas";

export const GET = withPublicApiRoute(
  "public_api_appointments_list",
  "appointments:read",
  async (request, { auth, traceId }) => {
    const url = new URL(request.url);
    const parsed = apiListAppointmentsQuerySchema.safeParse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      professional_id: url.searchParams.get("professional_id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return publicApiError(firstZodIssue(parsed.error), 400, traceId);
    }

    const admin = createAdminClient();
    const fromIso = parsed.data.from ? new Date(parsed.data.from).toISOString() : null;
    const toIso = parsed.data.to ? new Date(parsed.data.to).toISOString() : null;

    const { data, error } = await admin.rpc("api_list_appointments", {
      p_clinic_id: auth.clinicId,
      p_from: fromIso,
      p_to: toIso,
      p_professional_id: parsed.data.professional_id ?? null,
      p_status: parsed.data.status ?? null,
      p_limit: parsed.data.limit ?? 100,
    });

    if (error) {
      return publicApiError(
        resolvePostgresUserMessage(error, { fallback: error.message }),
        500,
        traceId
      );
    }

    return publicApiJson(data ?? [], { traceId, clinicId: auth.clinicId });
  }
);

export const POST = withPublicApiRoute(
  "public_api_appointments_create",
  "appointments:write",
  async (request, { auth, traceId }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return publicApiError("JSON inválido", 400, traceId);
    }

    const parsed = apiCreateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return publicApiError(firstZodIssue(parsed.error), 400, traceId);
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("api_submit_appointment", {
      p_clinic_id: auth.clinicId,
      p_professional_id: parsed.data.professional_id,
      p_start_at: parsed.data.start_at,
      p_first_name: parsed.data.first_name,
      p_last_name: parsed.data.last_name,
      p_document_number: parsed.data.document_number,
      p_phone: parsed.data.phone,
      p_email: parsed.data.email || null,
      p_reason: parsed.data.reason || null,
    });

    if (error) {
      return publicApiError(
        resolvePostgresUserMessage(error, { fallback: error.message }),
        422,
        traceId
      );
    }

    return publicApiJson(data, { status: 201, traceId, clinicId: auth.clinicId });
  }
);
