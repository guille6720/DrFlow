import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { filterAvailabilityRulesByLocation } from "@/core/booking/location-filters";
import { generateAvailableSlots } from "@/core/booking/slots";
import { toAppointmentAgendaRows } from "@/core/supabase/appointment-agenda-map";
import { APPOINTMENT_AGENDA_COLUMNS } from "@/core/supabase/select-columns";

import { getAppointmentHorizonDaysAhead } from "@/lib/utils/appointment-booking-horizon";

export async function loadTurnosWizardSlots(
  supabase: SupabaseClient,
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

  const [{ data: rulesRaw }, { data: appointments }, { data: blocks }] = await Promise.all([
    rulesQuery,
    supabase
      .from("appointments")
      .select(`${APPOINTMENT_AGENDA_COLUMNS}, patients(first_name, last_name, document_number, insurance_provider, insurance_plan)`)
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .neq("status", "cancelled")
      .gte("start_at", rangeStart)
      .lte("start_at", rangeEnd)
      .order("start_at"),
    supabase
      .from("schedule_blocks")
      .select("start_at, end_at, reason")
      .eq("clinic_id", clinicId)
      .or(`professional_id.is.null,professional_id.eq.${professionalId}`)
      .gte("start_at", rangeStart)
      .lte("start_at", rangeEnd),
  ]);

  const rules = filterAvailabilityRulesByLocation(rulesRaw ?? [], locationId);

  const appointmentRows = toAppointmentAgendaRows(appointments ?? []);
  const blockRows = (blocks ?? []).map((block) => ({
    start_at: block.start_at,
    end_at: block.end_at,
    reason: block.reason as string | null,
  }));

  const slots = generateAvailableSlots({
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
