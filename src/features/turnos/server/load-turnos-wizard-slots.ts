import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { filterAvailabilityRulesByLocation } from "@/core/booking/location-filters";
import { generateAvailableSlots } from "@/core/booking/slots";
import { selectAppointmentAgendaRows } from "@/core/supabase/appointment-agenda-select";

import { getAppointmentHorizonDaysAhead } from "@/lib/utils/appointment-booking-horizon";
import type { Database } from "@/types/supabase";

export function getSharedDemoRoomId(clinicId: string | null | undefined) {
  if (process.env.APP_ENV === "fiscalization" && clinicId === "3e31ffeb-052f-46d2-9eeb-2f69fb1b34fa") {
    return "9572c488-e9cb-4021-af8d-7f93a03d9f71";
  }
  return undefined;
}

export async function loadTurnosWizardSlots(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  professionalId: string,
  options?: { daysAhead?: number; fromDate?: Date; locationId?: string | null }
) {
  const daysAhead = options?.daysAhead ?? getAppointmentHorizonDaysAhead(options?.fromDate);
  const fromDate = options?.fromDate ?? new Date();
  const rangeStart = fromDate.toISOString();
  const rangeEnd = new Date(fromDate.getTime() + daysAhead * 86_400_000).toISOString();
  const locationId = options?.locationId ?? null;

  const rulesQuery = supabase
    .from("availability_rules")
    .select("day_of_week, start_time, end_time, slot_duration, location_id")
    .eq("clinic_id", clinicId)
    .eq("professional_id", professionalId)
    .eq("is_active", true);

  const sharedRoom = getSharedDemoRoomId(clinicId);
  const roomBusyQuery = sharedRoom
    ? supabase.rpc("get_lamejor_demo_room_busy", {
        p_location_id: locationId ?? sharedRoom,
        p_range_start: rangeStart,
        p_range_end: rangeEnd,
      })
    : Promise.resolve(null);

  const [{ data: rulesRaw }, agendaResult, { data: blocks }, roomBusy] = await Promise.all([
    rulesQuery,
    selectAppointmentAgendaRows(supabase, {
      clinicId,
      professionalId,
      rangeStart,
      rangeEnd,
      embedPatients: true,
      excludeCancelled: true,
    }),
    supabase
      .from("schedule_blocks")
      .select("start_at, end_at, reason")
      .eq("clinic_id", clinicId)
      .or(`professional_id.is.null,professional_id.eq.${professionalId}`)
      .gte("start_at", rangeStart)
      .lte("start_at", rangeEnd),
    roomBusyQuery,
  ]);

  const rules = filterAvailabilityRulesByLocation(rulesRaw ?? [], locationId);

  const appointmentRows = agendaResult.rows;
  const blockRows = [
    ...(blocks ?? []),
    ...(roomBusy?.data ?? []).map((interval) => ({ ...interval, reason: "Consultorio ocupado" })),
  ];
  const slots = roomBusy?.error ? [] : generateAvailableSlots({
    rules: rules ?? [],
    appointments: appointmentRows.map((row) => ({
      start_at: row.start_at,
      end_at: row.end_at,
    })),
    blocks: blockRows,
    daysAhead,
    fromDate,
    maxSlots: 0,
  });

  return { slots, appointments: appointmentRows, scheduleBlocks: blockRows, rules: rules ?? [] };
}
