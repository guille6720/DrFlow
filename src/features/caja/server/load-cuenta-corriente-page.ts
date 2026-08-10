import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildPageMeta,
  CUENTA_CORRIENTE_LEDGER_PAGE_SIZE,
  offsetRange,
  type PageMeta,
  parsePageParam,
} from "@/core/supabase/pagination";

export { CUENTA_CORRIENTE_LEDGER_PAGE_SIZE, parsePageParam as parseCuentaCorrientePage };

export type CuentaCorrienteLedgerEntry = {
  id: string;
  entry_at: string;
  concept: string;
  debit: number;
  credit: number;
  balance_after: number;
  notes: string | null;
};

export type CuentaCorrienteSelectedPatient = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
};

export type CuentaCorrientePageData = {
  selectedPatient: CuentaCorrienteSelectedPatient | null;
  entries: CuentaCorrienteLedgerEntry[];
  balance: number;
  pageMeta: PageMeta;
};

export function buildCuentaCorrienteUrl(patientId: string, page = 1): string {
  const params = new URLSearchParams({ patient: patientId });
  if (page > 1) params.set("page", String(page));
  return `/caja/cuenta-corriente?${params.toString()}`;
}

export async function loadCuentaCorrientePageData(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string | undefined,
  page: number
): Promise<CuentaCorrientePageData> {
  if (!patientId) {
    return {
      selectedPatient: null,
      entries: [],
      balance: 0,
      pageMeta: buildPageMeta(0, page, CUENTA_CORRIENTE_LEDGER_PAGE_SIZE),
    };
  }

  const { from, to } = offsetRange(page, CUENTA_CORRIENTE_LEDGER_PAGE_SIZE);

  const [{ data: patient }, { count, data: ledger }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name, document_number")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .maybeSingle(),
    supabase
      .from("patient_ledger_entries")
      .select("id, entry_at, concept, debit, credit, balance_after, notes", { count: "exact" })
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("entry_at", { ascending: false })
      .range(from, to),
  ]);

  if (!patient) {
    return {
      selectedPatient: null,
      entries: [],
      balance: 0,
      pageMeta: buildPageMeta(0, page, CUENTA_CORRIENTE_LEDGER_PAGE_SIZE),
    };
  }

  const entries = (ledger ?? []).map((entry) => ({
    ...entry,
    debit: Number(entry.debit),
    credit: Number(entry.credit),
    balance_after: Number(entry.balance_after),
  }));

  let balance = entries[0]?.balance_after ?? 0;
  if (entries.length === 0) {
    const { data: latest } = await supabase
      .from("patient_ledger_entries")
      .select("balance_after")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("entry_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    balance = Number(latest?.balance_after ?? 0);
  }

  return {
    selectedPatient: patient,
    entries,
    balance,
    pageMeta: buildPageMeta(count ?? 0, page, CUENTA_CORRIENTE_LEDGER_PAGE_SIZE),
  };
}
