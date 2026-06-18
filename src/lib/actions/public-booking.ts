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
  };
}

export async function loadPublicBookingSlots(
  slug: string,
  professionalId: string
) {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("public_booking_links")
    .select("clinic_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!link) return { error: "Link inválido", slots: [] };

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
  });

  return { slots };
}
