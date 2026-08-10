import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildPageMeta,
  offsetRange,
  type PageMeta,
  parsePageParam,
  PAYMENTS_PAGE_SIZE,
} from "@/core/supabase/pagination";
import type { PaymentListRow } from "@/core/supabase/query-types";

export { parsePageParam as parsePagosPage, PAYMENTS_PAGE_SIZE };

export function buildPagosUrl(page = 1): string {
  return page > 1 ? `/pagos?page=${page}` : "/pagos";
}

export type PagosPageData = {
  payments: PaymentListRow[];
  pageMeta: PageMeta;
};

export async function loadPagosPageData(
  supabase: SupabaseClient,
  clinicId: string,
  page: number
): Promise<PagosPageData> {
  const { from, to } = offsetRange(page, PAYMENTS_PAGE_SIZE);

  const { data, count } = await supabase
    .from("payments")
    .select(
      "id, clinic_id, patient_id, amount, deposit_amount, status, created_at, paid_at, patients(first_name, last_name)",
      { count: "exact" }
    )
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .range(from, to);

  return {
    payments: (data ?? []) as PaymentListRow[],
    pageMeta: buildPageMeta(count ?? 0, page, PAYMENTS_PAGE_SIZE),
  };
}
