import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildPageMeta,
  CAJA_REPORTES_PAGE_SIZE,
  offsetRange,
  type PageMeta,
  parsePageParam,
} from "@/core/supabase/pagination";

export { CAJA_REPORTES_PAGE_SIZE, parsePageParam as parseCajaReportesPage };

export type CajaReporteChargeRow = {
  id: string;
  charged_at: string;
  amount: number;
  charge_kind: string;
  attention_type: string;
  payment_method: string;
  status: string;
  patients: { last_name: string; first_name: string } | { last_name: string; first_name: string }[] | null;
  professionals: unknown;
};

export type CajaReportesPageData = {
  charges: CajaReporteChargeRow[];
  pageMeta: PageMeta;
  periodTotal: number;
  periodCount: number;
  from: string;
  to: string;
};

export function buildCajaReportesUrl(from: string, to: string, page = 1): string {
  const params = new URLSearchParams({ from, to });
  if (page > 1) params.set("page", String(page));
  return `/caja/reportes?${params.toString()}`;
}

async function sumCollectedForPeriod(
  supabase: SupabaseClient,
  clinicId: string,
  fromIso: string,
  toIso: string
): Promise<{ total: number; count: number }> {
  const { data: rpcData, error } = await supabase.rpc("sum_collected_cash_charges", {
    p_clinic_id: clinicId,
    p_from: fromIso,
    p_to: toIso,
  });

  if (!error && rpcData?.[0]) {
    const row = rpcData[0] as { total: number; charge_count: number };
    return { total: Number(row.total), count: Number(row.charge_count) };
  }

  const { data } = await supabase
    .from("cash_charges")
    .select("amount")
    .eq("clinic_id", clinicId)
    .eq("status", "collected")
    .gte("charged_at", fromIso)
    .lte("charged_at", toIso);

  const rows = data ?? [];
  return {
    total: rows.reduce((sum, row) => sum + Number(row.amount), 0),
    count: rows.length,
  };
}

export async function loadCajaReportesPageData(
  supabase: SupabaseClient,
  clinicId: string,
  from: string,
  to: string,
  page: number
): Promise<CajaReportesPageData> {
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;
  const { from: rangeFrom, to: rangeTo } = offsetRange(page, CAJA_REPORTES_PAGE_SIZE);

  const [chargesRes, summary] = await Promise.all([
    supabase
      .from("cash_charges")
      .select(
        "id, charged_at, amount, charge_kind, attention_type, payment_method, status, patients(last_name, first_name), professionals(display_name, profiles(full_name))",
        { count: "exact" }
      )
      .eq("clinic_id", clinicId)
      .eq("status", "collected")
      .gte("charged_at", fromIso)
      .lte("charged_at", toIso)
      .order("charged_at", { ascending: false })
      .range(rangeFrom, rangeTo),
    sumCollectedForPeriod(supabase, clinicId, fromIso, toIso),
  ]);

  return {
    charges: (chargesRes.data ?? []) as CajaReporteChargeRow[],
    pageMeta: buildPageMeta(chargesRes.count ?? 0, page, CAJA_REPORTES_PAGE_SIZE),
    periodTotal: summary.total,
    periodCount: summary.count,
    from,
    to,
  };
}
