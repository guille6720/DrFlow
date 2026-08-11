import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  OsLiquidationBatchRow,
  OsPendingSummaryRow,
} from "@/features/facturacion/utils/os-liquidacion";

export type LiquidacionPageData = {
  batches: OsLiquidationBatchRow[];
  pending: OsPendingSummaryRow[];
};

export async function loadLiquidacionPageData(
  supabase: SupabaseClient,
  clinicId: string
): Promise<LiquidacionPageData> {
  const [{ data: batches }, { data: pending }] = await Promise.all([
    supabase
      .from("os_liquidation_batches")
      .select(
        "id, insurance_provider, period_from, period_to, status, total_amount, item_count, submitted_at, paid_at, notes, created_at"
      )
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.rpc("summarize_os_liquidation_pending", { p_clinic_id: clinicId }),
  ]);

  return {
    batches: (batches ?? []).map(mapBatchRow),
    pending: (pending ?? []).map((row: Record<string, unknown>) => ({
      insurance_provider: row.insurance_provider as string,
      pending_count: Number(row.pending_count ?? 0),
      pending_amount: Number(row.pending_amount ?? 0),
    })),
  };
}

function mapBatchRow(row: Record<string, unknown>): OsLiquidationBatchRow {
  return {
    id: row.id as string,
    insurance_provider: row.insurance_provider as string,
    period_from: row.period_from as string,
    period_to: row.period_to as string,
    status: row.status as OsLiquidationBatchRow["status"],
    total_amount: Number(row.total_amount ?? 0),
    item_count: Number(row.item_count ?? 0),
    submitted_at: (row.submitted_at as string | null) ?? null,
    paid_at: (row.paid_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
  };
}
