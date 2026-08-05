import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth } from "date-fns";
import {
  labelForAttentionType,
  labelForChargeKind,
  labelForPaymentMethod,
} from "@/lib/constants/cash-register";
import type {
  AdminAnalyticsBreakdownRow,
  AdminAnalyticsSnapshot,
  AdminAuthorizationDocRow,
} from "@/lib/utils/admin-analytics-types";

type ChargeAgg = {
  total: number;
  count: number;
  byPaymentMethod: Record<string, number>;
  byChargeKind: Record<string, number>;
  byAttentionType: Record<string, number>;
  copago: number;
  coseguro: number;
};

import { unwrapJoin } from "@/core/supabase/unwrap-join";

function aggregateCharges(charges: Array<{
  amount: number;
  payment_method: string;
  attention_type: string;
  charge_kind: string;
}>): ChargeAgg {
  const byPaymentMethod: Record<string, number> = {};
  const byChargeKind: Record<string, number> = {};
  const byAttentionType: Record<string, number> = {};
  let total = 0;
  let copago = 0;
  let coseguro = 0;

  for (const c of charges) {
    const amt = Number(c.amount);
    total += amt;
    byPaymentMethod[c.payment_method] = (byPaymentMethod[c.payment_method] ?? 0) + amt;
    byChargeKind[c.charge_kind] = (byChargeKind[c.charge_kind] ?? 0) + amt;
    byAttentionType[c.attention_type] = (byAttentionType[c.attention_type] ?? 0) + amt;
    if (c.charge_kind === "copago_autorizado") copago += amt;
    if (c.charge_kind === "coseguro_autorizado") coseguro += amt;
  }

  return {
    total,
    count: charges.length,
    byPaymentMethod,
    byChargeKind,
    byAttentionType,
    copago,
    coseguro,
  };
}

function toBreakdown(
  map: Record<string, number>,
  labelFn: (code: string) => string
): AdminAnalyticsBreakdownRow[] {
  return Object.entries(map)
    .map(([code, amount]) => ({ code, label: labelFn(code), amount }))
    .sort((a, b) => b.amount - a.amount);
}

async function sumCollectedCharges(
  supabase: SupabaseClient,
  clinicId: string,
  from: string,
  to: string
): Promise<ChargeAgg> {
  const { data: rpcData, error: rpcError } = await supabase.rpc("sum_collected_cash_charges", {
    p_clinic_id: clinicId,
    p_from: from,
    p_to: to,
  });

  if (!rpcError && rpcData?.[0]) {
    const row = rpcData[0] as { total: number; charge_count: number };
    return {
      total: Number(row.total),
      count: Number(row.charge_count),
      byPaymentMethod: {},
      byChargeKind: {},
      byAttentionType: {},
      copago: 0,
      coseguro: 0,
    };
  }

  const { data } = await supabase
    .from("cash_charges")
    .select("amount, payment_method, attention_type, charge_kind")
    .eq("clinic_id", clinicId)
    .eq("status", "collected")
    .gte("charged_at", from)
    .lte("charged_at", to);

  return aggregateCharges(data ?? []);
}

async function loadTodayBreakdown(
  supabase: SupabaseClient,
  clinicId: string,
  from: string,
  to: string
): Promise<ChargeAgg> {
  const { data } = await supabase
    .from("cash_charges")
    .select("amount, payment_method, attention_type, charge_kind")
    .eq("clinic_id", clinicId)
    .eq("status", "collected")
    .gte("charged_at", from)
    .lte("charged_at", to);

  return aggregateCharges(data ?? []);
}

/** Load revenue + authorization snapshot for admin analytics agent (Phase H). */
export async function loadRevenueSnapshot(
  supabase: SupabaseClient,
  clinicId: string
): Promise<AdminAnalyticsSnapshot> {
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();
  const dateLabel = format(now, "yyyy-MM-dd");

  const [todayAgg, monthAgg, closureRes, authDocsRes, authCountRes] = await Promise.all([
    loadTodayBreakdown(supabase, clinicId, todayStart, todayEnd),
    sumCollectedCharges(supabase, clinicId, monthStart, monthEnd),
    supabase
      .from("cash_daily_closures")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("closure_date", dateLabel)
      .maybeSingle(),
    supabase
      .from("patient_admin_documents")
      .select("id, title, file_name, created_at, patients(first_name, last_name)")
      .eq("clinic_id", clinicId)
      .eq("category", "authorization")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("patient_admin_documents")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("category", "authorization"),
  ]);

  const recentAuthorizations: AdminAuthorizationDocRow[] = (authDocsRes.data ?? []).map((d) => {
    const p = unwrapJoin(d.patients ?? null);
    return {
      title: d.title || d.file_name,
      patientName: p ? `${p.last_name}, ${p.first_name}` : "Paciente",
      createdAt: d.created_at,
    };
  });

  return {
    dateLabel,
    todayTotal: todayAgg.total,
    todayChargeCount: todayAgg.count,
    monthTotal: monthAgg.total,
    monthChargeCount: monthAgg.count,
    copagoTotal: todayAgg.copago,
    coseguroTotal: todayAgg.coseguro,
    closureClosedToday: Boolean(closureRes.data?.id),
    paymentBreakdown: toBreakdown(todayAgg.byPaymentMethod, labelForPaymentMethod),
    chargeKindBreakdown: toBreakdown(todayAgg.byChargeKind, labelForChargeKind),
    attentionBreakdown: toBreakdown(todayAgg.byAttentionType, labelForAttentionType),
    authorizationCount: authCountRes.count ?? recentAuthorizations.length,
    recentAuthorizations,
  };
}
