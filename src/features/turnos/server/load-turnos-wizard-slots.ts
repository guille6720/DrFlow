import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateAvailableSlots } from "@/core/booking/slots";
import type { AppointmentAgendaRow } from "@/core/supabase/query-types";
import { APPOINTMENT_AGENDA_COLUMNS } from "@/core/supabase/select-columns";

export async function loadTurnosWizardSlots(
  supabase: SupabaseClient,
  clinicId: string,
  professionalId: string,
  options?: { daysAhead?: number; fromDate?: Date }
) {
  const daysAhead = options?.daysAhead ?? 21;
  const fromDate = options?.fromDate ?? new Date();
  const rangeStart = fromDate.toISOString();
  const rangeEnd = new Date(fromDate.getTime() + daysAhead * 86_400_000).toISOString();

  const [{ data: rules }, { data: appointments }, { data: blocks }] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, slot_duration")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .eq("is_active", true),
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

  const appointmentRows = (appointments ?? []) as AppointmentAgendaRow[];
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
  });

  return { slots, appointments: appointmentRows, scheduleBlocks: blockRows, rules: rules ?? [] };
}
