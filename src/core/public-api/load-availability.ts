import "server-only";

import { generateAvailableSlots } from "@/core/booking/slots";
import { createAdminClient } from "@/core/supabase/admin";

export async function loadPublicApiAvailability(
  clinicId: string,
  professionalId: string,
  daysAhead = 21
) {
  const admin = createAdminClient();
  const fromDate = new Date();
  const rangeEnd = new Date(fromDate.getTime() + daysAhead * 86_400_000);

  const [{ data: clinic }, { data: rules }, { data: occupancy }, { data: blocks }] =
    await Promise.all([
      admin.from("clinics").select("timezone, default_appointment_duration").eq("id", clinicId).single(),
      admin
        .from("availability_rules")
        .select("day_of_week, start_time, end_time, slot_duration")
        .eq("clinic_id", clinicId)
        .eq("professional_id", professionalId)
        .eq("is_active", true),
      admin.rpc("api_get_booking_occupancy", {
        p_clinic_id: clinicId,
        p_professional_id: professionalId,
        p_from: fromDate.toISOString(),
        p_to: rangeEnd.toISOString(),
      }),
      admin
        .from("schedule_blocks")
        .select("start_at, end_at")
        .eq("clinic_id", clinicId)
        .eq("professional_id", professionalId)
        .gte("end_at", fromDate.toISOString()),
    ]);

  const { DEFAULT_CLINIC_TIMEZONE } = await import("@/shared/utils/clinic-timezone");
  const timeZone = (clinic?.timezone as string | undefined) ?? DEFAULT_CLINIC_TIMEZONE;

  const slots = generateAvailableSlots({
    rules: rules ?? [],
    appointments: occupancy ?? [],
    blocks: blocks ?? [],
    daysAhead,
    fromDate,
    timeZone,
  });

  return { slots, timeZone };
}
