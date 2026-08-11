import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  OsBillableItemRow,
  OsLiquidationBatchRow,
} from "@/features/facturacion/utils/os-liquidacion";

export type LiquidacionDetailPageData = {
  batch: OsLiquidationBatchRow | null;
  items: OsBillableItemRow[];
};

export async function loadLiquidacionDetailPageData(
  supabase: SupabaseClient,
  clinicId: string,
  batchId: string
): Promise<LiquidacionDetailPageData> {
  const { data: batch } = await supabase
    .from("os_liquidation_batches")
    .select(
      "id, insurance_provider, period_from, period_to, status, total_amount, item_count, submitted_at, paid_at, notes, created_at"
    )
    .eq("clinic_id", clinicId)
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) {
    return { batch: null, items: [] };
  }

  const { data: items } = await supabase
    .from("os_billable_items")
    .select(
      "id, appointment_id, patient_id, professional_id, insurance_provider, insurance_number, insurance_plan, practice_code, practice_label, amount, copago_collected, status, attended_at, patients(first_name, last_name), professionals(display_name, profiles(full_name))"
    )
    .eq("clinic_id", clinicId)
    .eq("liquidation_batch_id", batchId)
    .order("attended_at", { ascending: true });

  return {
    batch: {
      id: batch.id,
      insurance_provider: batch.insurance_provider,
      period_from: batch.period_from,
      period_to: batch.period_to,
      status: batch.status,
      total_amount: Number(batch.total_amount ?? 0),
      item_count: Number(batch.item_count ?? 0),
      submitted_at: batch.submitted_at,
      paid_at: batch.paid_at,
      notes: batch.notes,
      created_at: batch.created_at,
    },
    items: (items ?? []).map(mapItemRow),
  };
}

function mapItemRow(row: Record<string, unknown>): OsBillableItemRow {
  const patients = row.patients as { first_name?: string; last_name?: string } | null;
  const professionals = row.professionals as
    | { display_name?: string | null; profiles?: { full_name?: string } | { full_name?: string }[] | null }
    | null;
  const profile = professionals?.profiles;
  const fullName = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;

  return {
    id: row.id as string,
    appointment_id: (row.appointment_id as string | null) ?? null,
    patient_id: row.patient_id as string,
    professional_id: (row.professional_id as string | null) ?? null,
    insurance_provider: row.insurance_provider as string,
    insurance_number: (row.insurance_number as string | null) ?? null,
    insurance_plan: (row.insurance_plan as string | null) ?? null,
    practice_code: row.practice_code as string,
    practice_label: row.practice_label as string,
    amount: Number(row.amount ?? 0),
    copago_collected: Number(row.copago_collected ?? 0),
    status: row.status as OsBillableItemRow["status"],
    attended_at: row.attended_at as string,
    patient_name: patients
      ? `${patients.last_name ?? ""}, ${patients.first_name ?? ""}`.trim()
      : undefined,
    professional_name: professionals?.display_name ?? fullName ?? undefined,
  };
}
