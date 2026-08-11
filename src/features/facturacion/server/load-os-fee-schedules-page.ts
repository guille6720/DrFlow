import type { SupabaseClient } from "@supabase/supabase-js";

import type { OsFeeScheduleRow } from "@/features/facturacion/utils/os-liquidacion";

export async function loadOsFeeSchedulesPageData(
  supabase: SupabaseClient,
  clinicId: string
): Promise<OsFeeScheduleRow[]> {
  const { data } = await supabase
    .from("os_fee_schedules")
    .select("id, insurance_provider, practice_code, practice_label, amount, is_active")
    .eq("clinic_id", clinicId)
    .order("insurance_provider");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    insurance_provider: row.insurance_provider as string,
    practice_code: row.practice_code as string,
    practice_label: row.practice_label as string,
    amount: Number(row.amount ?? 0),
    is_active: Boolean(row.is_active),
  }));
}
