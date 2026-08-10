import type { SupabaseClient } from "@supabase/supabase-js";

export type CashClosureDayTotals = {
  totals: Record<string, number>;
  patientCount: number;
  consultationCount: number;
};

const PAYMENT_METHODS = ["cash", "debit", "credit", "transfer", "mercadopago", "qr", "account"] as const;

function emptyTotals(): Record<string, number> {
  const totals: Record<string, number> = {
    general: 0,
    particular: 0,
    copago: 0,
    coseguro: 0,
    art: 0,
    obra_social: 0,
  };
  for (const method of PAYMENT_METHODS) {
    totals[method] = 0;
  }
  return totals;
}

function totalsFromChargeRows(
  charges: Array<{
    amount: number | string;
    payment_method: string;
    attention_type: string;
    charge_kind: string;
    patient_id: string;
  }>
): CashClosureDayTotals {
  const totals = emptyTotals();
  const patients = new Set<string>();

  for (const charge of charges) {
    patients.add(charge.patient_id);
    const amt = Number(charge.amount);
    totals.general += amt;
    if (charge.payment_method in totals) {
      totals[charge.payment_method] += amt;
    }
    if (charge.charge_kind === "consulta_particular") totals.particular += amt;
    if (charge.charge_kind === "copago_autorizado") totals.copago += amt;
    if (charge.charge_kind === "coseguro_autorizado") totals.coseguro += amt;
    if (charge.attention_type === "art") totals.art += amt;
    if (charge.attention_type === "obra_social") totals.obra_social += amt;
  }

  return {
    totals,
    patientCount: patients.size,
    consultationCount: charges.length,
  };
}

function parseClosureRpcRow(row: Record<string, unknown>): CashClosureDayTotals {
  const totals = emptyTotals();
  for (const key of Object.keys(totals)) {
    totals[key] = Number(row[key] ?? 0);
  }
  return {
    totals,
    patientCount: Number(row.patient_count ?? 0),
    consultationCount: Number(row.consultation_count ?? 0),
  };
}

/** Aggregates collected charges for daily closure without scanning all rows in app code. */
export async function loadCashClosureDayTotals(
  supabase: SupabaseClient,
  clinicId: string,
  dayStart: string,
  dayEnd: string
): Promise<CashClosureDayTotals> {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "summarize_collected_cash_charges_for_closure",
    {
      p_clinic_id: clinicId,
      p_from: dayStart,
      p_to: dayEnd,
    }
  );

  if (!rpcError && rpcData && typeof rpcData === "object") {
    return parseClosureRpcRow(rpcData as Record<string, unknown>);
  }

  const { data: charges } = await supabase
    .from("cash_charges")
    .select("amount, payment_method, attention_type, charge_kind, patient_id")
    .eq("clinic_id", clinicId)
    .eq("status", "collected")
    .gte("charged_at", dayStart)
    .lte("charged_at", dayEnd);

  return totalsFromChargeRows(charges ?? []);
}
