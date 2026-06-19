"use server";

import { createClient } from "@/lib/supabase/server";
import { publicBookingSchema } from "@/lib/validations/public-booking";
import { sanitizeText } from "@/lib/validations/schemas";

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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
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
    p_email: data.email ? sanitizeText(data.email) : null,
    p_reason: data.reason ? sanitizeText(data.reason) : null,
  });

  if (error) {
    const msg = error.message.includes("horario")
      ? "Ese horario ya no está disponible. Elegí otro."
      : error.message.includes("Link")
        ? "El link de reserva no es válido."
        : "No pudimos registrar tu solicitud. Intentá de nuevo.";
    return { error: msg };
  }

  return {
    success: true,
    appointmentId: (result as { appointment_id?: string })?.appointment_id,
    startAt: data.start_at,
    documentNumber: data.document_number,
    patientName: `${data.first_name} ${data.last_name}`.trim(),
  };
}

export async function fetchPatientAppointmentStatuses(
  slug: string,
  documentNumber: string,
  appointmentIds: string[]
) {
  if (!appointmentIds.length) {
    return {
      statuses: [] as Array<{
        appointmentId: string;
        status: string;
        startAt: string;
        bookingSource: string | null;
        cancellationReason: string | null;
        cancelledAt: string | null;
        cancelledByType: string | null;
      }>,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_patient_appointment_statuses", {
    p_slug: slug,
    p_document_number: documentNumber.trim(),
    p_appointment_ids: appointmentIds,
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
  documentNumber: string,
  appointmentId: string,
  reason: string
) {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    return { error: "Indicá el motivo de la cancelación (mín. 3 caracteres)" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_patient_appointment", {
    p_slug: slug,
    p_document_number: documentNumber.trim(),
    p_appointment_id: appointmentId,
    p_reason: trimmed,
  });

  if (error) {
    if (error.message.includes("REASON_REQUIRED")) {
      return { error: "Indicá el motivo de la cancelación" };
    }
    if (error.message.includes("APPOINTMENT_NOT_FOUND")) {
      return { error: "No encontramos ese turno o ya no se puede cancelar" };
    }
    return { error: "No pudimos cancelar el turno. Intentá de nuevo." };
  }

  return { success: true };
}

export async function loadPublicBookingSlots(
  slug: string,
  professionalId: string
) {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("public_booking_links")
    .select("clinic_id, clinics(timezone)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!link) return { error: "Link inválido", slots: [] };

  const clinic = link.clinics as { timezone?: string } | null;
  const { DEFAULT_CLINIC_TIMEZONE } = await import("@/lib/utils/clinic-timezone");
  const timeZone = clinic?.timezone ?? DEFAULT_CLINIC_TIMEZONE;

  const { generateAvailableSlots } = await import("@/lib/booking/slots");

  const [rules, appointments, blocks] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, slot_duration")
      .eq("clinic_id", link.clinic_id)
      .eq("professional_id", professionalId)
      .eq("is_active", true),
    supabase
      .from("appointments")
      .select("start_at, end_at")
      .eq("clinic_id", link.clinic_id)
      .eq("professional_id", professionalId)
      .not("status", "eq", "cancelled")
      .gte("start_at", new Date().toISOString()),
    supabase
      .from("schedule_blocks")
      .select("start_at, end_at")
      .eq("clinic_id", link.clinic_id)
      .eq("professional_id", professionalId)
      .gte("end_at", new Date().toISOString()),
  ]);

  const slots = generateAvailableSlots({
    rules: rules.data ?? [],
    appointments: appointments.data ?? [],
    blocks: blocks.data ?? [],
    timeZone,
  });

  return { slots };
}
