"use server";

import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import {
  CONSENT_TYPES,
  LEGAL_PATIENT_NOTICE_VERSION,
} from "@/core/legal/documents";
import {
  getPortalAuthErrorMessage,
  getPortalSessionRequiredMessage,
  readPatientPortalToken,
} from "@/core/portal/patient-portal-cookie";
import { nullToUndefined } from "@/core/supabase/json";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue } from "@/core/validations/params";
import {
  publicBookingCancelSchema,
  publicBookingPortalAppointmentsSchema,
  publicBookingSchema,
  publicBookingSlotsSchema,
  publicBookingStatusesSchema,
} from "@/core/validations/public-booking";
import { sanitizeText } from "@/core/validations/schemas";

async function requireValidPortalToken(slug: string): Promise<
  | { ok: true; token: string }
  | { ok: false; error: string }
> {
  const token = await readPatientPortalToken();
  if (!token) {
    return { ok: false, error: getPortalSessionRequiredMessage() };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_patient_portal_session_v2", {
    p_token: token,
    p_slug: slug,
  });

  const row = Array.isArray(data) ? data[0] : data;
  const valid = Boolean(row && (row as { valid?: boolean }).valid === true);
  if (error || !valid) {
    return { ok: false, error: getPortalAuthErrorMessage() };
  }

  return { ok: true, token };
}

export async function submitPublicBooking(formData: FormData) {
  const parsed = publicBookingSchema.safeParse({
    slug: formData.get("slug"),
    professional_id: formData.get("professional_id"),
    start_at: formData.get("start_at"),
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    document_number: formData.get("document_number"),
    phone: formData.get("phone"),
    email: formData.get("email") || "",
    reason: formData.get("reason") || "",
    privacy_consent: formData.get("privacy_consent"),
  });

  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc("submit_public_booking", {
    p_slug: data.slug,
    p_professional_id: data.professional_id,
    p_start_at: data.start_at,
    p_first_name: sanitizeText(data.first_name),
    p_last_name: sanitizeText(data.last_name),
    p_document_number: sanitizeText(data.document_number),
    p_phone: sanitizeText(data.phone),
    p_email: nullToUndefined(data.email ? sanitizeText(data.email) : null),
    p_reason: nullToUndefined(data.reason ? sanitizeText(data.reason) : null),
    p_consent_type: CONSENT_TYPES.patientDataProcessingBooking,
    p_consent_document_version: LEGAL_PATIENT_NOTICE_VERSION,
  });

  if (error) {
    return {
      error: resolvePostgresUserMessage(error, {
        fallback: "No pudimos registrar tu solicitud. Intentá de nuevo.",
      }),
    };
  }

  const row = result as {
    appointment_id?: string;
    patient_id?: string;
  };

  return {
    success: true,
    appointmentId: row.appointment_id,
    startAt: data.start_at,
    documentNumber: data.document_number,
    patientName: `${data.first_name} ${data.last_name}`.trim(),
  };
}

export async function fetchPatientAppointmentStatuses(
  slug: string,
  appointmentIds: string[]
) {
  const parsed = publicBookingStatusesSchema.safeParse({
    slug,
    appointment_ids: appointmentIds,
  });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error), statuses: [] };
  }
  if (parsed.data.appointment_ids.length === 0) {
    return { statuses: [] };
  }

  const auth = await requireValidPortalToken(parsed.data.slug);
  if (!auth.ok) {
    return { error: auth.error, statuses: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_patient_appointment_statuses_v2", {
    p_token: auth.token,
    p_appointment_ids: parsed.data.appointment_ids,
  });

  if (error) return { error: "No pudimos consultar el estado", statuses: [] };

  const statuses = (data ?? []).map(
    (row: {
      appointment_id: string;
      status: string;
      start_at: string;
      booking_source: string | null;
      cancellation_reason: string | null;
      cancelled_at: string | null;
      cancelled_by_type: string | null;
    }) => ({
      appointmentId: row.appointment_id,
      status: row.status,
      startAt: row.start_at,
      bookingSource: row.booking_source,
      cancellationReason: row.cancellation_reason,
      cancelledAt: row.cancelled_at,
      cancelledByType: row.cancelled_by_type,
    })
  );

  return { statuses };
}

export async function cancelPatientAppointment(
  slug: string,
  appointmentId: string,
  reason: string
) {
  const parsed = publicBookingCancelSchema.safeParse({
    slug,
    appointment_id: appointmentId,
    reason: reason.trim(),
  });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error) };
  }

  const auth = await requireValidPortalToken(parsed.data.slug);
  if (!auth.ok) {
    return { error: auth.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_patient_appointment_v2", {
    p_token: auth.token,
    p_appointment_id: parsed.data.appointment_id,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return {
      error: resolvePostgresUserMessage(error, {
        rpcMessages: {
          APPOINTMENT_NOT_FOUND: "No encontramos ese turno o ya no se puede cancelar",
          INVALID_PORTAL_SESSION: getPortalAuthErrorMessage(),
        },
        fallback: "No pudimos cancelar el turno. Intentá de nuevo.",
      }),
    };
  }

  return { success: true };
}

export async function fetchPatientPortalAppointments(slug: string) {
  const parsed = publicBookingPortalAppointmentsSchema.safeParse({ slug });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error), appointments: [], authenticated: false };
  }

  const token = await readPatientPortalToken();
  if (!token) {
    // No session yet — UI shows the secure-link prompt (not a hard error).
    return { appointments: [], authenticated: false };
  }

  const auth = await requireValidPortalToken(parsed.data.slug);
  if (!auth.ok) {
    return { error: auth.error, appointments: [], authenticated: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_patient_portal_appointments_v2", {
    p_token: auth.token,
  });

  if (error) {
    return { error: "No pudimos consultar tus turnos", appointments: [], authenticated: true };
  }

  const appointments = (data ?? []).map(
    (row: {
      appointment_id: string;
      status: string;
      start_at: string;
      end_at: string;
      booking_source: string | null;
      cancellation_reason: string | null;
      cancelled_at: string | null;
      cancelled_by_type: string | null;
      professional_name: string | null;
      patient_name: string;
      created_at: string;
    }) => ({
      appointmentId: row.appointment_id,
      status: row.status,
      startAt: row.start_at,
      endAt: row.end_at,
      bookingSource: row.booking_source,
      cancellationReason: row.cancellation_reason,
      cancelledAt: row.cancelled_at,
      cancelledByType: row.cancelled_by_type,
      professionalName: row.professional_name,
      patientName: row.patient_name,
      createdAt: row.created_at,
    })
  );

  return { appointments, authenticated: true };
}

export async function loadPublicBookingSlots(
  slug: string,
  professionalId: string
) {
  const parsed = publicBookingSlotsSchema.safeParse({ slug, professional_id: professionalId });
  if (!parsed.success) {
    return { error: firstZodIssue(parsed.error), slots: [] };
  }

  const supabase = await createClient();

  const { data: link } = await supabase
    .from("public_booking_links")
    .select("clinic_id, clinics(timezone)")
    .eq("slug", parsed.data.slug)
    .eq("is_active", true)
    .single();

  if (!link) return { error: "Link inválido", slots: [] };

  const clinic = link.clinics as { timezone?: string } | null;
  const { DEFAULT_CLINIC_TIMEZONE } = await import("@/shared/utils/clinic-timezone");
  const timeZone = clinic?.timezone ?? DEFAULT_CLINIC_TIMEZONE;

  const { generateAvailableSlots } = await import("@/core/booking/slots");

  const [rules, occupancy, blocks] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, slot_duration")
      .eq("clinic_id", link.clinic_id)
      .eq("professional_id", parsed.data.professional_id)
      .eq("is_active", true),
    supabase.rpc("get_public_booking_occupancy", {
      p_slug: parsed.data.slug,
      p_professional_id: parsed.data.professional_id,
    }),
    supabase
      .from("schedule_blocks")
      .select("start_at, end_at")
      .eq("clinic_id", link.clinic_id)
      .eq("professional_id", parsed.data.professional_id)
      .gte("end_at", new Date().toISOString()),
  ]);

  const slots = generateAvailableSlots({
    rules: rules.data ?? [],
    appointments: occupancy.data ?? [],
    blocks: blocks.data ?? [],
    timeZone,
  });

  return { slots };
}
