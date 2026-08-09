import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateAvailableSlots } from "@/core/booking/slots";

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
      .select("start_at, end_at")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .neq("status", "cancelled")
      .gte("start_at", rangeStart)
      .lte("start_at", rangeEnd),
    supabase
      .from("schedule_blocks")
      .select("start_at, end_at")
      .eq("clinic_id", clinicId)
      .or(`professional_id.is.null,professional_id.eq.${professionalId}`)
      .gte("start_at", rangeStart)
      .lte("start_at", rangeEnd),
  ]);

  const slots = generateAvailableSlots({
    rules: rules ?? [],
    appointments: appointments ?? [],
    blocks: blocks ?? [],
    daysAhead,
    fromDate,
  });

  return { slots, rules: rules ?? [] };
}
